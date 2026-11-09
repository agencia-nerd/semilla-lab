// Prueba de carga de SemillaLab: simula el evento con N personas a la vez (todas desde UNA IP, como el WiFi).
//
//   API_BASE=https://alonsom22.sg-host.com USERS=800 PROFILE=evento ADMIN_PIN=... STAFF_PIN=... node tools/loadtest.mjs
//
// ⚠ Escribe datos (registros, votos, canjes). Los participantes usan códigos con prefijo CODE_PREFIX (LT por defecto)
//   y CLEANUP=1 (por defecto) los borra al final. Cierra y reabre la votación para probar el "Cierre de votación".
//   No correrlo durante el evento real.
//
// Variables:
//   API_BASE   dónde va la API (/api/*).                         Por defecto BASE o http://localhost:8080
//   PAGE_BASE  de dónde se piden las páginas (HTML/JS/CSS).        Por defecto = API_BASE. PAGES=0 para no pedirlas.
//   ORIGIN     cabecera Origin en la API (para probar CORS).      Por defecto PAGE_BASE si es distinto de API_BASE.
//   PROFILE    evento (llegada en RAMP=1200 s, pausas 20–60 s) | estres (RAMP=120 s, pausas 1–4 s)
//   USERS, RAMP, THINK_MIN, THINK_MAX, CAMERA (prob. de escanear con la cámara del celular = recarga la página, 0.3),
//   RACE (prob. de doble canje simultáneo en un puesto, 0.08)
//   SPIKE=1 pico final de votos simultáneos · CLOSE=1 prueba de cierre de votación · CLEANUP=1 borra los datos de prueba
//   OUT archivo JSON de resultados
//
// Qué simula, todo en paralelo:
//  - Personas que llegan durante RAMP: abren la página por un QR, se registran (algunas vuelven a ingresar con su código),
//    votan los 10 stands con pausas; algunas escanean con la cámara (recarga la página) y otras desde la app;
//    al desbloquear un premio, algunas dejan el vale abierto (consulta cada 8 s, como la app).
//  - Pantalla de proyección y panel admin (resumen cada 30 s) y exportación CSV.
//  - 4 puestos de staff (uno por premio): lista de pendientes cada 30 s, búsqueda por número de canje y canje;
//    dobles canjes seguidos y SIMULTÁNEOS (dos puestos a la vez) que el servidor debe rechazar.
//  - Casos borde: PIN incorrecto, código repetido, stand inexistente, voto con la votación cerrada.
//  - Al final, un pico: todas las personas votan en el mismo instante.

const env = process.env;
const API = (env.API_BASE || env.BASE || "http://localhost:8080").replace(/\/$/, "");
const PAGE = (env.PAGE_BASE || API).replace(/\/$/, "");
const ORIGIN = env.ORIGIN ?? (PAGE !== API ? PAGE : "");
const PAGES = env.PAGES !== "0";
const PROFILE = env.PROFILE || "evento";
const PRESET = PROFILE === "estres" ? { ramp: 120, tmin: 1, tmax: 4 } : { ramp: 1200, tmin: 20, tmax: 60 };
const USERS = Number(env.USERS || 800);
const RAMP = Number(env.RAMP || PRESET.ramp) * 1000;
const THINK_MIN = Number(env.THINK_MIN || PRESET.tmin) * 1000;
const THINK_MAX = Number(env.THINK_MAX || PRESET.tmax) * 1000;
const CAMERA = Number(env.CAMERA ?? 0.3);
const RACE = Number(env.RACE ?? 0.08); // prob. de que dos puestos canjeen a la misma persona a la vez
const ADMIN_PIN = env.ADMIN_PIN || "";
const STAFF_PIN = env.STAFF_PIN || "";
const PREFIX = (env.CODE_PREFIX || "LT").toUpperCase();
const RUN = Date.now().toString(36).slice(-4).toUpperCase();
const flag = (k, d = "1") => (env[k] ?? d) !== "0";
const SPIKE = flag("SPIKE"), CLOSE = flag("CLOSE"), CLEANUP = flag("CLEANUP");
const PRIZE_KEYS = ["canchita", "gaseosa", "helado", "pancho"];

if (!ADMIN_PIN || !STAFF_PIN) { console.error("Faltan ADMIN_PIN y STAFF_PIN"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const NAMES = ["Rosa", "Luis", "María", "Jorge", "Lucía", "Carlos", "Ana", "Pedro", "Elena", "Diego", "Sofía", "Raúl"];
const LAST = ["Quispe", "Paredes", "Chunga", "Vílchez", "Ruiz", "Sandoval", "Peña", "Ríos", "Medina", "Llontop", "Castro", "Flores"];

// ---------- métricas ----------
const M = new Map();
const started = Date.now();
let running = true;
let inflight = 0, maxInflight = 0;
const issues = []; // fallos de reglas de negocio (no de rendimiento)
function rec(name, ms, status, ok) {
  if (!M.has(name)) M.set(name, { lat: [], ok: 0, bad: 0, codes: {} });
  const m = M.get(name);
  m.lat.push(ms);
  m.codes[status] = (m.codes[status] || 0) + 1;
  ok ? m.ok++ : m.bad++;
}
const ADMIN_H = { "x-admin-pin": ADMIN_PIN };
const STAFF_H = { "x-staff-pin": STAFF_PIN };
async function call(name, path, { method = "GET", body, headers = {}, okCodes = [200, 201], base = API, raw = false } = {}) {
  const t = performance.now();
  let status = 0, data = null, cors = null;
  inflight++; maxInflight = Math.max(maxInflight, inflight);
  try {
    const h = { ...(body ? { "content-type": "application/json" } : {}), ...headers };
    const isApi = base === API && path.startsWith("/api/");
    if (isApi && ORIGIN) h.origin = ORIGIN;
    const res = await fetch(base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
    status = res.status;
    cors = res.headers.get("access-control-allow-origin");
    const txt = await res.text();
    if (raw) data = txt;
    else { try { data = JSON.parse(txt); } catch { data = txt; } }
    // Página de verificación anti-bots (HTML donde se esperaba JSON) = bloqueo de plataforma.
    if (!raw && isApi && typeof data === "string" && status !== 204) status = `html-${status}`;
  } catch (e) {
    status = e.name === "TimeoutError" ? "timeout" : "neterr";
  } finally { inflight--; }
  if (ORIGIN && path.startsWith("/api/") && base === API && typeof status === "number" && cors !== ORIGIN) corsMissing++;
  rec(name, performance.now() - t, status, okCodes.includes(status));
  return { status, data };
}
let corsMissing = 0;

async function page(path) {
  if (!PAGES) return;
  await call("PÁGINA html", path, { base: PAGE, raw: true });
  await Promise.all(["/app.js", "/styles.css", "/palette.js"].map((f) => call("PÁGINA js/css", f, { base: PAGE, raw: true })));
}

// ---------- participantes ----------
let stands = [];
const people = []; // { code, name, auth, done }
async function participant(i) {
  await sleep(rand(0, RAMP));
  const code = `${PREFIX}${RUN}-${String(i).padStart(4, "0")}`;
  const name = `${pick(NAMES)} ${pick(LAST)} ${pick(LAST)}`;
  const order = shuffle(stands);
  await page(`/?stand=${order[0].id}`);
  const r = await call("POST register", "/api/register", { method: "POST", body: { name, code, consent: true } });
  if (!r.data?.user) return;
  const me = { code, name, auth: { authorization: `Bearer ${r.data.user.phone}:${r.data.user.token}` }, done: false };
  people.push(me);
  await call("GET stands", "/api/stands");
  await call("GET me", "/api/me", { headers: me.auth });

  // 10 %: vuelve a ingresar con su código (otro celular o borró datos) → debe recuperar su sesión.
  if (Math.random() < 0.1) {
    const l = await call("POST login", "/api/login", { method: "POST", body: { code } });
    if (l.data?.user) me.auth = { authorization: `Bearer ${l.data.user.phone}:${l.data.user.token}` };
  }

  let valeOpen = false;
  for (const s of order) {
    await sleep(rand(THINK_MIN, THINK_MAX));
    if (Math.random() < CAMERA) await page(`/?stand=${s.id}`); // escaneo con la cámara: recarga la página
    const v = await call("POST vote", "/api/vote", {
      method: "POST", headers: me.auth,
      body: { standId: s.id, stars: 1 + Math.floor(Math.random() * 5), tags: Math.random() < 0.5 ? [pick(["impacto", "tiempo", "facil", "original"])] : [] },
    });
    if (Math.random() < 0.3) await call("GET me", "/api/me", { headers: me.auth });
    // Al desbloquear un premio, 40 % abre el vale y lo deja abierto ~40 s (la app consulta cada 8 s).
    const unlocked = v.data?.prizes?.filter((z) => z.unlocked).length || 0;
    if (unlocked && !valeOpen && Math.random() < 0.4) {
      valeOpen = true;
      (async () => { for (let k = 0; k < 5 && running; k++) { await sleep(8000); await call("GET me (vale abierto)", "/api/me", { headers: me.auth }); } valeOpen = false; })();
    }
  }
  me.done = true;
}

// ---------- pantallas internas ----------
async function screen(name, delay) {
  await sleep(delay);
  while (running) { await call(name, "/api/admin?action=summary", { headers: ADMIN_H }); await sleep(30_000); }
}
async function exporter() {
  await sleep(RAMP / 2);
  if (running) await call("GET admin export CSV", "/api/admin?action=export", { headers: ADMIN_H, raw: true });
}

let doubleTries = 0, doubleBlocked = 0, claimsOk = 0, raceTries = 0, raceDoubleGranted = 0;
const claim = (id, prize) => call("POST staff canje", "/api/staff?action=claim", { method: "POST", headers: STAFF_H, body: { id, prize }, okCodes: [200, 409] });
async function booth(prize) {
  let pending = [], lastList = 0;
  await sleep(rand(20_000, 40_000));
  while (running) {
    if (Date.now() - lastList > 30_000) {
      const r = await call("GET staff pendientes", `/api/staff?action=search&prize=${prize}`, { headers: STAFF_H });
      pending = (r.data?.people || []).filter((p) => p.prizes?.find((z) => z.key === prize && z.unlocked && !z.claimed));
      lastList = Date.now();
    }
    const p = pending.shift();
    if (p) {
      const id = p.id || p.phone;
      const ticket = p.prizes.find((z) => z.key === prize)?.ticket;
      // El staff busca por el número del vale (o por nombre si no tiene número).
      const q = ticket ? String(ticket) : encodeURIComponent(p.name.split(" ").slice(0, 2).join(" "));
      const f = await call("GET staff buscar", `/api/staff?action=search&q=${q}&prize=${prize}`, { headers: STAFF_H });
      if (ticket && !(f.data?.people || []).some((x) => (x.id || x.phone) === id)) issues.push(`Búsqueda por número ${ticket} (${prize}) no encontró a ${id}`);
      if (Math.random() < RACE) {
        // Dos puestos canjean a la misma persona en el mismo instante: solo uno debe pasar.
        raceTries++;
        const [a, b] = await Promise.all([claim(id, prize), claim(id, prize)]);
        const oks = [a, b].filter((x) => x.status === 200).length;
        if (oks === 1) claimsOk++;
        if (oks > 1) { raceDoubleGranted++; claimsOk++; issues.push(`Doble canje SIMULTÁNEO aceptado: ${id} ${prize}`); }
      } else {
        const c = await claim(id, prize);
        if (c.status === 200) {
          claimsOk++;
          if (Math.random() < 0.2) { // la persona vuelve a pedir → debe dar 409
            doubleTries++;
            const d = await call("POST staff doble canje (debe 409)", "/api/staff?action=claim", { method: "POST", headers: STAFF_H, body: { id, prize }, okCodes: [409] });
            if (d.status === 409) doubleBlocked++; else issues.push(`Doble canje seguido aceptado: ${id} ${prize}`);
          }
        }
      }
    }
    await sleep(rand(4000, 9000));
  }
}

// ---------- casos borde ----------
async function edgeCases() {
  const exp = async (label, path, opts, want) => {
    const r = await call(`BORDE ${label}`, path, { ...opts, okCodes: [want] });
    if (r.status !== want) issues.push(`${label}: esperaba ${want}, respondió ${r.status}`);
    return r;
  };
  await exp("PIN admin incorrecto", "/api/admin?action=summary", { headers: { "x-admin-pin": "x" } }, 401);
  await exp("PIN staff incorrecto", "/api/staff?action=search", { headers: { "x-staff-pin": "x" } }, 401);
  await exp("login código inexistente", "/api/login", { method: "POST", body: { code: `${PREFIX}NOEXISTE${RUN}` } }, 404);
  const code = `${PREFIX}${RUN}-EDGE`;
  const a = await exp("registro nuevo", "/api/register", { method: "POST", body: { name: "Prueba Borde", code, consent: true } }, 201);
  const b = await exp("registro código repetido", "/api/register", { method: "POST", body: { name: "Otro Nombre", code, consent: true } }, 200);
  if (b.data?.existing !== true || b.data?.user?.name !== "Prueba Borde") issues.push("Código repetido no devolvió a la persona original");
  const auth = { authorization: `Bearer ${a.data?.user?.phone}:${a.data?.user?.token}` };
  await exp("stand inexistente", "/api/vote", { method: "POST", headers: auth, body: { standId: "zz99", stars: 3 } }, 404);
  await exp("token inválido", "/api/vote", { method: "POST", headers: { authorization: `Bearer ${code}:malo` }, body: { standId: stands[0].id, stars: 3 } }, 401);
  extraCodes.push(code);
  return auth;
}
const extraCodes = [];

// ---------- reporte ----------
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
function report(title) {
  const rows = [...M.entries()].map(([k, m]) => ({
    endpoint: k, n: m.lat.length, ok: m.ok, err: m.bad,
    p50: Math.round(pct(m.lat, 50)), p95: Math.round(pct(m.lat, 95)), p99: Math.round(pct(m.lat, 99)), max: Math.round(Math.max(...m.lat)),
    codes: Object.entries(m.codes).map(([c, n]) => `${c}:${n}`).join(" "),
  }));
  console.log(`\n=== ${title} · ${((Date.now() - started) / 1000).toFixed(0)} s ===`);
  console.table(rows);
  return rows;
}
// Solicitudes por segundo (por ventana de 10 s) para comparar con el umbral de Netlify (~10/s por IP).
const perWindow = [];
let lastTotal = 0;
const totalReqs = () => [...M.values()].reduce((n, m) => n + m.lat.length, 0);

// ---------- ejecución ----------
console.log(`Prueba de carga · perfil ${PROFILE} · ${USERS} personas en ${RAMP / 1000} s · pausas ${THINK_MIN / 1000}-${THINK_MAX / 1000} s`);
console.log(`API → ${API}${ORIGIN ? ` (Origin ${ORIGIN})` : ""} · páginas → ${PAGES ? PAGE : "no"} · run ${RUN}`);
stands = (await call("GET stands", "/api/stands")).data?.stands || [];
if (!stands.length) { console.error("No se pudieron leer los stands"); process.exit(1); }
const cfg0 = (await call("GET admin summary (inicio)", "/api/admin?action=summary", { headers: ADMIN_H })).data;
if (!cfg0?.config) { console.error("PIN de admin incorrecto o servidor no disponible"); process.exit(1); }
if (!cfg0.config.votingOpen) await call("POST admin abrir votación", "/api/admin?action=config", { method: "POST", headers: ADMIN_H, body: { votingOpen: true } });
const base0 = cfg0.stats?.registered || 0;
const edgeAuth = await edgeCases();

const bg = [screen("GET admin summary (proyección)", 0), screen("GET admin summary (panel)", 15_000), exporter(), ...PRIZE_KEYS.map(booth)];
const ticker = setInterval(() => {
  const t = totalReqs(), rps = (t - lastTotal) / 10;
  lastTotal = t; perWindow.push(rps);
  const v = M.get("POST vote");
  console.log(`  ${((Date.now() - started) / 1000).toFixed(0)} s · ${rps.toFixed(1)} sol/s · en curso ${inflight} · registrados ${people.length}/${USERS} · terminaron ${people.filter((p) => p.done).length} · votos ${v?.ok || 0} · canjes ${claimsOk}`);
}, 10_000);
await Promise.all(Array.from({ length: USERS }, (_, i) => participant(i)));
report("Fase 1 · llegada y votación");

let spikeMs = null;
if (SPIKE) {
  const t0 = performance.now();
  await Promise.all(people.map((p) => call("POST vote (pico simultáneo)", "/api/vote", { method: "POST", headers: p.auth, body: { standId: stands[0].id, stars: 5 } })));
  spikeMs = Math.round(performance.now() - t0);
}
await sleep(35_000); // deja que los puestos terminen un ciclo
running = false;
clearInterval(ticker);
await Promise.race([Promise.all(bg), sleep(10_000)]);

// Cierre de votación: cerrar, comprobar que rechaza votos y que el resumen tiene ganador; luego reabrir.
let closeTest = null;
if (CLOSE) {
  await call("POST admin cerrar votación", "/api/admin?action=config", { method: "POST", headers: ADMIN_H, body: { votingOpen: false } });
  const v = await call("BORDE voto con votación cerrada", "/api/vote", { method: "POST", headers: edgeAuth, body: { standId: stands[1].id, stars: 4 }, okCodes: [403] });
  if (v.status !== 403) issues.push(`Voto con votación cerrada: esperaba 403, respondió ${v.status}`);
  const s = (await call("GET admin summary (cierre)", "/api/admin?action=summary", { headers: ADMIN_H })).data;
  closeTest = { rejected: v.status === 403, top: s?.ranking?.[0] ? { name: s.ranking[0].name, avg: s.ranking[0].avg, votes: s.ranking[0].count } : null };
  await call("POST admin reabrir votación", "/api/admin?action=config", { method: "POST", headers: ADMIN_H, body: { votingOpen: true } });
}
const all = report("Final (incluye pico y cierre)");

// Consistencia (el resumen se comparte 15 s: se espera a que se recalcule).
await sleep(16_000);
const fresh = (await call("GET admin summary (verificación)", "/api/admin?action=summary", { headers: ADMIN_H })).data;
const expected = { registered: base0 + people.length + extraCodes.length, votes: people.filter((p) => p.done).length * stands.length };
const stats = fresh?.stats || null;
if (stats && stats.registered !== expected.registered) issues.push(`Registrados: servidor ${stats.registered}, esperado ${expected.registered}`);
const ps = fresh?.prizeStats?.map((p) => ({ key: p.key, unlocked: p.unlocked, tickets: p.tickets, claimed: p.claimed })) || [];
for (const p of ps) if (p.tickets < p.unlocked) issues.push(`${p.key}: ${p.unlocked - p.tickets} personas desbloquearon sin número de canje`);

let cleaned = 0;
if (CLEANUP) {
  const codes = [...people.map((p) => p.code), ...extraCodes];
  for (let i = 0; i < codes.length; i += 10) {
    const r = await Promise.all(codes.slice(i, i + 10).map((code) => fetch(`${API}/api/admin?action=deleteUser`, { method: "POST", headers: { "content-type": "application/json", ...ADMIN_H }, body: JSON.stringify({ phone: code }) }).then((x) => x.ok).catch(() => false)));
    cleaned += r.filter(Boolean).length;
  }
}

const reqTotal = totalReqs();
const durS = Math.round((Date.now() - started) / 1000);
const result = {
  profile: PROFILE, api: API, page: PAGES ? PAGE : null, origin: ORIGIN || null, users: USERS, rampS: RAMP / 1000, thinkS: [THINK_MIN / 1000, THINK_MAX / 1000],
  durationS: durS, requests: reqTotal, rpsAvg: +(reqTotal / durS).toFixed(1), rpsPeak10s: Math.max(0, ...perWindow), maxInflight,
  spike: SPIKE ? { requests: people.length, totalMs: spikeMs } : null,
  claims: { ok: claimsOk, doubleTries, doubleBlocked, raceTries, raceDoubleGranted },
  close: closeTest, corsMissing: ORIGIN ? corsMissing : null,
  expected, server: stats, prizeStats: ps, cleaned,
  issues, endpoints: all,
};
console.log(`\nSolicitudes: ${reqTotal} en ${durS} s · promedio ${result.rpsAvg}/s · pico ${result.rpsPeak10s}/s · máx. en curso ${maxInflight}`);
if (SPIKE) console.log(`Pico: ${people.length} votos simultáneos en ${spikeMs} ms`);
console.log(`Canjes: ${claimsOk} ok · dobles seguidos ${doubleBlocked}/${doubleTries} bloqueados · simultáneos ${raceTries} (aceptados dos veces: ${raceDoubleGranted})`);
if (closeTest) console.log(`Cierre: voto rechazado ${closeTest.rejected ? "sí" : "NO"} · primero ${closeTest.top?.name || "-"}`);
if (ORIGIN) console.log(`CORS: respuestas sin cabecera para ${ORIGIN}: ${corsMissing}`);
console.log("Servidor:", JSON.stringify(stats), "· esperado:", JSON.stringify(expected));
console.log(issues.length ? `\n⚠ ${issues.length} problemas:\n - ${[...new Set(issues)].slice(0, 30).join("\n - ")}` : "\n✔ Sin problemas de reglas de negocio");
if (CLEANUP) console.log(`Limpieza: ${cleaned} participantes de prueba borrados`);
const fs = await import("node:fs");
fs.writeFileSync(env.OUT || "loadtest-results.json", JSON.stringify(result, null, 2));
console.log(`Resultados en ${env.OUT || "loadtest-results.json"}`);
