// Prueba de carga de Semilla Lab: simula un evento con N personas a la vez.
//
//   BASE=https://mi-sitio USERS=300 ADMIN_PIN=xxx STAFF_PIN=yyy node tools/loadtest.mjs
//
// ⚠ Escribe datos (registros, votos, canjes). Úsalo contra una copia, NO contra producción.
//
// Qué simula, todo en paralelo:
//  - USERS personas que llegan en RAMP s: abren la página, se registran y votan todos los stands
//    (pausas de THINK_MIN–THINK_MAX s entre votos, mucho más rápido que un evento real),
//    revisan "Mi cosecha" y algunas dejan su vale abierto (consulta cada 4 s).
//  - La pantalla de proyección (resumen cada 30 s) y el panel admin (cada 15 s).
//  - 4 puestos de staff (uno por premio): lista de pendientes cada 20 s, búsquedas por nombre y canjes,
//    incluyendo intentos de doble canje que el servidor debe rechazar (409).
//  - Al final, un pico: todas las personas votan en el mismo instante.
// Las personas comparten la IP de la máquina que corre el script, igual que en el WiFi de un evento.

const BASE = (process.env.BASE || "http://localhost:8080").replace(/\/$/, "");
const USERS = Number(process.env.USERS || 300);
const RAMP = Number(process.env.RAMP || 60) * 1000;
const THINK_MIN = Number(process.env.THINK_MIN || 2) * 1000;
const THINK_MAX = Number(process.env.THINK_MAX || 8) * 1000;
const ADMIN_PIN = process.env.ADMIN_PIN || "";
const STAFF_PIN = process.env.STAFF_PIN || "";
const PHONE_BASE = Number(process.env.PHONE_BASE || 950000000);

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
function rec(name, ms, status, ok) {
  if (!M.has(name)) M.set(name, { lat: [], ok: 0, bad: 0, codes: {} });
  const m = M.get(name);
  m.lat.push(ms);
  m.codes[status] = (m.codes[status] || 0) + 1;
  ok ? m.ok++ : m.bad++;
}
async function call(name, path, { method = "GET", body, headers = {}, okCodes = [200, 201] } = {}) {
  const t = performance.now();
  let status = 0, data = null;
  try {
    const res = await fetch(BASE + path, {
      method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    status = res.status;
    const txt = await res.text();
    try { data = JSON.parse(txt); } catch { data = txt; }
  } catch (e) {
    status = e.name === "TimeoutError" ? "timeout" : "neterr";
  }
  rec(name, performance.now() - t, status, okCodes.includes(status));
  return { status, data };
}

// ---------- participantes ----------
let stands = [];
const people = []; // {phone, name, token}
async function participant(i) {
  await sleep(rand(0, RAMP));
  const phone = String(PHONE_BASE + i);
  const name = `${pick(NAMES)} ${pick(LAST)} ${pick(LAST)} ${i}`;
  await call("GET / (página)", "/");
  await call("GET /app.js", "/app.js");
  const r = await call("POST register", "/api/register", { method: "POST", body: { name, phone, consent: true } });
  if (!r.data?.user) return;
  const auth = { authorization: `Bearer ${phone}:${r.data.user.token}` };
  const me = { phone, name, auth };
  people.push(me);
  await call("GET stands", "/api/stands");
  await call("GET me", "/api/me", { headers: auth });

  let valeOpened = false;
  for (const s of shuffle(stands)) {
    await sleep(rand(THINK_MIN, THINK_MAX));
    const v = await call("POST vote", "/api/vote", {
      method: "POST", headers: auth,
      body: { standId: s.id, stars: 1 + Math.floor(Math.random() * 5), tags: Math.random() < 0.5 ? [pick(["impacto", "tiempo", "facil", "original"])] : [] },
    });
    if (Math.random() < 0.3) await call("GET me", "/api/me", { headers: auth });
    // La mitad abre su vale apenas desbloquea la canchita y lo deja abierto ~20 s.
    if (!valeOpened && v.data?.count >= 4 && Math.random() < 0.5) {
      valeOpened = true;
      (async () => { for (let k = 0; k < 5 && running; k++) { await sleep(4000); await call("GET me (vale abierto)", "/api/me", { headers: auth }); } })();
    }
  }
  me.done = true;
}

// ---------- pantallas internas ----------
async function projector() {
  while (running) { await call("GET admin summary (proyección)", "/api/admin?action=summary", { headers: { "x-admin-pin": ADMIN_PIN } }); await sleep(30_000); }
}
async function adminTab() {
  await sleep(5000);
  while (running) { await call("GET admin summary (panel)", "/api/admin?action=summary", { headers: { "x-admin-pin": ADMIN_PIN } }); await sleep(15_000); }
}
const claimed = new Set();
let doubleTries = 0, doubleBlocked = 0, claimsOk = 0;
async function booth(prize) {
  const h = { "x-staff-pin": STAFF_PIN };
  let pending = [];
  let lastList = 0;
  await sleep(rand(10_000, 20_000));
  while (running) {
    if (Date.now() - lastList > 20_000) {
      const r = await call("GET staff pendientes", `/api/staff?action=search&prize=${prize}`, { headers: h });
      pending = r.data?.people || [];
      lastList = Date.now();
    }
    const p = pending.shift();
    if (p) {
      // Busca por nombre (como lo haría el staff) y entrega.
      const q = encodeURIComponent(p.name.split(" ").slice(0, 2).join(" "));
      await call("GET staff buscar", `/api/staff?action=search&q=${q}`, { headers: h });
      const id = p.id || p.phone;
      const c = await call("POST staff canje", "/api/staff?action=claim", { method: "POST", headers: h, body: { id, prize }, okCodes: [200, 409] });
      if (c.status === 200) { claimsOk++; claimed.add(`${id}:${prize}`); }
      // 1 de cada 5: la persona vuelve a pedir → debe dar 409 "ya canjeó".
      if (c.status === 200 && Math.random() < 0.2) {
        doubleTries++;
        const d = await call("POST staff doble canje (debe 409)", "/api/staff?action=claim", { method: "POST", headers: h, body: { id, prize }, okCodes: [409] });
        if (d.status === 409) doubleBlocked++;
      }
    }
    await sleep(rand(3000, 6000));
  }
}

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

// ---------- ejecución ----------
console.log(`Prueba de carga → ${BASE} · ${USERS} personas · llegada en ${RAMP / 1000} s · pausas ${THINK_MIN / 1000}-${THINK_MAX / 1000} s`);
stands = (await call("GET stands", "/api/stands")).data?.stands || [];
if (!stands.length) { console.error("No se pudieron leer los stands"); process.exit(1); }
const bg = [projector(), adminTab(), ...["canchita", "gaseosa", "helado", "pancho"].map(booth)];
const ticker = setInterval(() => {
  const v = M.get("POST vote");
  console.log(`  ${((Date.now() - started) / 1000).toFixed(0)} s · registrados ${people.length}/${USERS} · terminaron ${people.filter((p) => p.done).length} · votos ${v?.ok || 0} · canjes ${claimsOk}`);
}, 10_000);
await Promise.all(Array.from({ length: USERS }, (_, i) => participant(i)));
const main = report("Fase 1 · llegada y votación");

// Pico: todas las personas votan exactamente a la vez.
const t0 = performance.now();
await Promise.all(people.map((p) => call("POST vote (pico simultáneo)", "/api/vote", { method: "POST", headers: p.auth, body: { standId: stands[0].id, stars: 5 } })));
const spikeMs = Math.round(performance.now() - t0);
await sleep(25_000); // deja que los puestos terminen un ciclo
running = false;
clearInterval(ticker);
await Promise.race([Promise.all(bg), sleep(8000)]);
const all = report("Final (incluye pico)");

// Verificación de consistencia
const sum = (await call("GET admin summary (verificación)", "/api/admin?action=summary", { headers: { "x-admin-pin": ADMIN_PIN } })).data;
await sleep(16_000);
const fresh = (await fetch(`${BASE}/api/admin?action=summary`, { headers: { "x-admin-pin": ADMIN_PIN } }).then((r) => r.json()).catch(() => null)) || sum;
const result = {
  base: BASE, users: USERS, durationS: Math.round((Date.now() - started) / 1000), spike: { requests: people.length, totalMs: spikeMs },
  claims: { ok: claimsOk, doubleTries, doubleBlocked },
  expected: { registered: people.length, votes: people.filter((p) => p.done).length * stands.length },
  server: fresh ? { stats: fresh.stats, prizeStats: fresh.prizeStats?.map((p) => ({ key: p.key, unlocked: p.unlocked, claimed: p.claimed })) } : null,
  endpoints: all,
};
console.log(`\nPico: ${people.length} votos simultáneos completados en ${spikeMs} ms`);
console.log(`Canjes: ${claimsOk} ok · dobles intentados ${doubleTries}, bloqueados ${doubleBlocked}`);
console.log("Servidor:", JSON.stringify(result.server?.stats), "· esperado:", JSON.stringify(result.expected));
const fs = await import("node:fs");
fs.writeFileSync(process.env.OUT || "loadtest-results.json", JSON.stringify(result, null, 2));
console.log(`Resultados en ${process.env.OUT || "loadtest-results.json"}`);
