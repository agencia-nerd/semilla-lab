// Prueba funcional con "personas reales" contra un servidor (por defecto producción en SiteGround).
// Crea participantes con código ZZTEST-xxxx, prueba los casos de uso y errores típicos, y los borra al final.
// NO cierra la votación ni resetea nada.
//
//   API_BASE=https://alonsom22.sg-host.com ORIGIN=https://semilla-lab-camposol.netlify.app \
//   ADMIN_PIN=... STAFF_PIN=... node tools/smoke-personas.mjs
//
const API = process.env.API_BASE || "https://alonsom22.sg-host.com";
const ORIGIN = process.env.ORIGIN || "https://semilla-lab-camposol.netlify.app";
const { ADMIN_PIN, STAFF_PIN } = process.env;
if (!ADMIN_PIN || !STAFF_PIN) { console.error("Faltan ADMIN_PIN y STAFF_PIN"); process.exit(2); }

const RUN = Math.random().toString(36).slice(2, 6).toUpperCase();
const code = (s) => `ZZTEST-${RUN}${s}`;
const created = new Set();
let pass = 0, failN = 0;
const ok = (cond, msg, extra = "") => { cond ? pass++ : failN++; console.log(`${cond ? "  ✔" : "  ✘"} ${msg}${!cond && extra ? `  →  ${extra}` : ""}`); };
const section = (t) => console.log(`\n▶ ${t}`);

async function call(path, { method = "GET", body, user, staff, admin } = {}) {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  if (user) headers.authorization = `Bearer ${user.phone}:${user.token}`;
  if (staff) headers["x-staff-pin"] = staff;
  if (admin) headers["x-admin-pin"] = admin;
  const t = Date.now();
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms: Date.now() - t, cors: res.headers.get("access-control-allow-origin") };
}
const register = async (name, c, consent = true) => {
  const r = await call("/api/register", { method: "POST", body: { name, code: c, consent } });
  if (r.data.user) created.add(r.data.user.phone);
  return r;
};
const vote = (user, standId, stars, tags) => call("/api/vote", { method: "POST", user, body: { standId, stars, tags } });
const staffSearch = (q, prize = "") => call(`/api/staff?action=search&q=${encodeURIComponent(q)}&prize=${prize}`, { staff: STAFF_PIN });
const claim = (id, prize, pin = STAFF_PIN) => call("/api/staff?action=claim", { method: "POST", staff: pin, body: { id, prize } });

try {
  section("Servidor");
  const st = await call("/api/stands");
  ok(st.status === 200, `GET /api/stands 200 (${st.ms} ms)`, st.status);
  ok(st.cors === ORIGIN, "CORS permite el origen de Netlify", st.cors);
  ok(st.data.config?.votingOpen === true, "Votación abierta", JSON.stringify(st.data.config));
  const stands = st.data.stands || [];
  ok(stands.length === 10, `10 stands (${stands.map((s) => s.id).join(",")})`, stands.length);
  const before = await call("/api/admin?action=summary", { admin: ADMIN_PIN });
  ok(before.status === 200, `Panel admin con PIN (registrados antes: ${before.data.stats?.registered})`, before.status);
  ok((await call("/api/admin?action=summary", { admin: "malo" })).status === 401, "Panel con PIN incorrecto → 401");
  ok((await call("/api/staff?action=search", { staff: "malo" })).status === 401, "Staff con PIN incorrecto → 401");

  section("Persona 2 · Errores de tipeo en el registro");
  let r = await register("Ana", code("A"));
  ok(r.status === 400, "Solo nombre (sin apellido) → 400", `${r.status} ${r.data.error}`);
  r = await register("Ana Zztest", code("A"), false);
  ok(r.status === 400, "Sin marcar autorización → 400", `${r.status} ${r.data.error}`);
  r = await register("Ana Zztest", "ab");
  ok(r.status === 400, "Código de 2 caracteres → 400", `${r.status} ${r.data.error}`);
  r = await register("  Ana   Zztest  Pérez ", `  ${code("a").toLowerCase().replace("-", "- ")} `);
  ok(r.status === 201, "Código en minúsculas y con espacios se acepta", `${r.status} ${r.data.error}`);
  const ana = r.data.user;
  ok(ana?.code === code("A"), `Código normalizado a ${code("A")}`, ana?.code);
  ok(ana?.name === "Ana Zztest Pérez", "Nombre limpio de espacios", ana?.name);

  section("Persona 3 · Mismo código desde otro celular / navegador");
  r = await register("Otro Nombre", code("A"));
  ok(r.status === 200 && r.data.existing === true, "Registro con código existente → existing:true", `${r.status}`);
  ok(r.data.user?.name === "Ana Zztest Pérez", "Entra como la dueña original (el nombre nuevo se ignora)", r.data.user?.name);
  r = await call("/api/login", { method: "POST", body: { code: code("a") } });
  ok(r.status === 200 && r.data.user?.token === ana.token, "'Ya me registré' con el código en minúsculas → misma sesión", r.status);
  r = await call("/api/login", { method: "POST", body: { code: code("NOEXISTE") } });
  ok(r.status === 404, "Código no registrado → 404 con mensaje para registrarse", `${r.status} ${r.data.error}`);

  section("Persona 5 · Tramposo / datos inválidos");
  ok((await call("/api/me", { user: { phone: ana.phone, token: "falso" } })).status === 401, "Token falso → 401");
  ok((await vote(ana, "s99", 5)).status === 404, "Stand inexistente → 404");
  ok((await vote(ana, stands[0].id, 6)).status === 400, "6 estrellas → 400");
  ok((await vote(ana, stands[0].id, 0)).status === 400, "0 estrellas → 400");
  r = await vote(ana, stands[0].id, 3, ["impacto", "tiempo", "facil", "original", "hackeo"]);
  ok(r.status === 200 && r.data.votes?.[stands[0].id]?.tags.length === 2, "5 etiquetas (1 inválida) → se guardan 2", JSON.stringify(r.data.votes?.[stands[0].id]));

  section("Persona 4 · Cambia de opinión");
  r = await vote(ana, stands[0].id, 2);
  r = await vote(ana, stands[0].id, 5);
  ok(r.data.count === 1 && r.data.votes[stands[0].id].stars === 5, "Votar 2 veces el mismo stand: cuenta 1, queda la última nota (5)", JSON.stringify({ c: r.data.count }));
  r = await claim(ana.phone, "canchita");
  ok(r.status === 409 && !r.data.alreadyClaimed, "Staff no puede entregar canchita con 1 voto → 409", `${r.status} ${r.data.error}`);

  section("Persona 1 · Recorre los 10 stands y canjea los 4 premios");
  const unlockedAt = {};
  for (let i = 1; i < stands.length; i++) {
    r = await vote(ana, stands[i].id, 1 + (i % 5));
    ok(r.status === 200, `Voto stand ${i + 1} (${r.ms} ms)`, `${r.status} ${r.data.error}`);
    for (const z of r.data.prizes || []) if (z.unlocked && !unlockedAt[z.key]) unlockedAt[z.key] = r.data.count;
  }
  ok(r.data.count === 10, "Conteo final 10/10", r.data.count);
  ok(unlockedAt.canchita === 3 && unlockedAt.gaseosa === 5 && unlockedAt.helado === 8 && unlockedAt.pancho === 10, "Premios se desbloquean a los 3, 5, 8 y 10", JSON.stringify(unlockedAt));
  const me = await call("/api/me", { user: ana });
  const tickets = Object.fromEntries(me.data.prizes.map((z) => [z.key, z.ticket]));
  ok(Object.values(tickets).every((n) => Number.isInteger(n) && n >= 1 && n <= 1000), `Número de canje en los 4 vales ${JSON.stringify(tickets)}`);

  section("Persona 6 · Staff busca a la persona");
  r = await staffSearch("ana zztest perez");
  ok(r.data.people?.some((p) => p.id === ana.phone), "Por nombre sin tildes (puede tardar hasta 15 s si el padrón estaba en caché)", r.data.people?.length);
  r = await staffSearch(code("a"));
  ok(r.data.people?.some((p) => p.id === ana.phone), "Por código de trabajador", r.data.people?.length);
  r = await staffSearch(String(tickets.helado), "helado");
  ok(r.data.people?.some((p) => p.id === ana.phone), `Por número de vale de helado (${tickets.helado})`, r.data.people?.length);

  section("Persona 7 · Canjes (incluye dos puestos a la vez)");
  for (const k of ["canchita", "gaseosa", "helado"]) {
    r = await claim(ana.phone, k);
    ok(r.status === 200, `Entrega ${k}`, `${r.status} ${r.data.error}`);
  }
  const [a, b] = await Promise.all([claim(ana.phone, "pancho"), claim(ana.phone, "pancho")]);
  ok([a.status, b.status].sort().join() === "200,409", "Dos canjes simultáneos de hot dog → solo 1 aceptado", `${a.status},${b.status}`);
  r = await claim(ana.phone, "canchita");
  ok(r.status === 409 && r.data.alreadyClaimed, "Pedir canchita de nuevo → 409 YA CANJEÓ", `${r.status} ${r.data.error}`);
  r = await call("/api/me", { user: ana });
  ok(r.data.prizes.every((z) => z.claimed), "El vale de la persona muestra los 4 como canjeados");
  r = await call("/api/staff?action=unclaim", { method: "POST", staff: STAFF_PIN, body: { id: ana.phone, prize: "canchita" } });
  ok(r.status === 403, "Staff no puede deshacer un canje → 403", r.status);

  section("Varias personas a la vez (20 registros + votos en paralelo)");
  const crowd = await Promise.all(Array.from({ length: 20 }, (_, i) => register(`Persona${i} Zztest`, code(`C${i}`))));
  ok(crowd.every((x) => x.status === 201), "20 registros simultáneos OK", crowd.map((x) => x.status).join(","));
  const votes = await Promise.all(crowd.flatMap((x) => stands.slice(0, 3).map((s) => vote(x.data.user, s.id, 4))));
  ok(votes.every((x) => x.status === 200), `60 votos simultáneos OK (máx ${Math.max(...votes.map((v) => v.ms))} ms)`, votes.filter((x) => x.status !== 200).map((x) => x.status).join(","));
  const t3 = await Promise.all(crowd.map((x) => call("/api/me", { user: x.data.user })));
  const nums = t3.map((x) => x.data.prizes.find((z) => z.key === "canchita").ticket);
  ok(nums.every(Boolean) && new Set(nums).size === nums.length, "Los 20 tienen número de canchita y ninguno se repite");
} catch (e) {
  failN++;
  console.error("\n✘ Error inesperado:", e);
} finally {
  section(`Limpieza (${created.size} participantes de prueba)`);
  let del = 0;
  for (const phone of created) {
    if (!phone.startsWith("ZZTEST-")) continue;
    const r = await call("/api/admin?action=deleteUser", { method: "POST", admin: ADMIN_PIN, body: { phone } });
    if (r.status === 200) del++;
  }
  ok(del === created.size, `Borrados ${del}/${created.size}`);
  const after = await call("/api/admin?action=summary", { admin: ADMIN_PIN });
  const left = after.data.stats?.registered;
  console.log(`  Registrados después de limpiar: ${left}`);
  const login = await call("/api/login", { method: "POST", body: { code: code("A") } });
  ok(login.status === 404, "El código de prueba quedó libre");
  console.log(`\n${failN ? "✘" : "✔"} ${pass} OK · ${failN} fallas`);
  process.exit(failN ? 1 : 0);
}
