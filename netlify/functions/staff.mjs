// Canje de premios para el staff de los puestos.
// Acceso: header x-staff-pin = STAFF_PIN (staff) o ADMIN_PIN (admin; además puede deshacer).
import {
  store, json, fail, readBody, getStands, getConfig, voteCount, prizeStatus, prizesFor, maskPhone, PHONE_RE, loadAll, cached, patchCached,
} from "./_lib.mjs";

const pins = () => ({
  staff: process.env.STAFF_PIN || (process.env.NETLIFY_DEV ? "staff2026" : null),
  admin: process.env.ADMIN_PIN || (process.env.NETLIFY_DEV ? "semilla2026" : null),
});

function roleOf(req) {
  const pin = req.headers.get("x-staff-pin") || "";
  const { staff, admin } = pins();
  if (admin && pin === admin) return "admin";
  if (staff && pin === staff) return "staff";
  return null;
}

// "Álvaro  Peña" -> "alvaro pena"
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Padrón compartido (15 s): nombre, cantidad de votos y canjes de cada persona.
// Es lo único que se lee para listar pendientes o buscar por nombre; las coincidencias
// de una búsqueda se vuelven a leer frescas antes de mostrarse.
function roster(s, stands) {
  return cached(s, "roster", 15_000, async () => {
    const [users, votes, claims] = await Promise.all([loadAll(s, "users/"), loadAll(s, "votes/"), loadAll(s, "claims/")]);
    const votesBy = Object.fromEntries(votes.map((v) => [v.key, v.value]));
    const claimsBy = Object.fromEntries(claims.map((c) => [c.key, c.value]));
    return users.map(({ value: u }) => ({
      name: u.name, phone: u.phone, n: norm(u.name),
      count: voteCount(votesBy[u.phone] || {}, stands), claims: claimsBy[u.phone] || {},
    }));
  });
}

async function person(s, u, stands, config) {
  const [votes, claims] = await Promise.all([
    s.get(`votes/${u.phone}`, { type: "json" }),
    s.get(`claims/${u.phone}`, { type: "json" }),
  ]);
  const count = voteCount(votes || {}, stands);
  return { name: u.name, phone: u.phone, phoneMasked: maskPhone(u.phone), count, prizes: prizeStatus(count, claims || {}, config) };
}

export default async (req) => {
  const role = roleOf(req);
  const { staff, admin } = pins();
  if (!staff && !admin) return fail("Falta configurar STAFF_PIN en el servidor", 503);
  if (!role) return fail("PIN incorrecto", 401);

  const s = store();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "search";
  const [stands, config] = await Promise.all([getStands(s), getConfig(s)]);

  if (req.method === "GET" && action === "search") {
    const q = norm(url.searchParams.get("q"));
    const prize = url.searchParams.get("prize") || "";
    const users = await roster(s, stands);
    const digits = q.replace(/\D/g, "");
    let matches;
    if (!q) matches = users;
    else matches = users.filter((u) => (digits.length >= 3 && u.phone.includes(digits)) || q.split(" ").every((w) => u.n.includes(w)));

    // Con búsqueda: hasta 30 coincidencias, leídas frescas.
    // Sin búsqueda: pendientes según el padrón (máx. 15 s de antigüedad; el canje se valida igual en el servidor).
    let result;
    if (q) {
      result = await Promise.all(matches.slice(0, 30).map((u) => person(s, u, stands, config)));
    } else {
      result = matches
        .map((u) => ({ name: u.name, phone: u.phone, phoneMasked: maskPhone(u.phone), count: u.count, prizes: prizeStatus(u.count, u.claims, config) }))
        .filter((p) => p.prizes.some((z) => z.unlocked && !z.claimed && (!prize || z.key === prize)));
    }
    result.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return json({
      role, prizes: prizesFor(config), total: users.length,
      people: result.slice(0, 60).map(({ phone, ...p }) => (role === "admin" ? { phone, ...p } : { id: phone, ...p })),
    });
  }

  if (req.method !== "POST") return fail("Acción no válida", 400);
  const body = await readBody(req);
  const phone = String(body.phone || body.id || "").replace(/\D/g, "");
  const key = String(body.prize || "");
  if (!PHONE_RE.test(phone)) return fail("Participante inválido");
  if (!prizesFor(config).some((p) => p.key === key)) return fail("Premio inválido");
  const user = await s.get(`users/${phone}`, { type: "json" });
  if (!user) return fail("Participante no encontrado", 404);

  const claimsKey = `claims/${phone}`;
  const claims = (await s.get(claimsKey, { type: "json" })) || {};

  if (action === "claim") {
    const p = await person(s, user, stands, config);
    const st = p.prizes.find((z) => z.key === key);
    if (!st.unlocked) return fail(`${user.name} aún no desbloquea ${st.name}: le faltan ${st.missing} stands`, 409);
    if (claims[key]) {
      return json({ error: `YA CANJEÓ ${st.name.toUpperCase()}`, alreadyClaimed: true, claimedAt: claims[key].at, person: { ...p, phone: undefined, id: phone } }, 409);
    }
    claims[key] = { at: new Date().toISOString(), by: role };
    await s.setJSON(claimsKey, claims);
    await patchCached(s, "roster", (list) => list.map((u) => (u.phone === phone ? { ...u, claims } : u)));
    return json({ ok: true, person: { ...(await person(s, user, stands, config)), phone: undefined, id: phone } });
  }

  if (action === "unclaim") {
    if (role !== "admin") return fail("Solo el admin puede deshacer un canje", 403);
    delete claims[key];
    await s.setJSON(claimsKey, claims);
    await patchCached(s, "roster", (list) => list.map((u) => (u.phone === phone ? { ...u, claims } : u)));
    return json({ ok: true, person: { ...(await person(s, user, stands, config)), id: phone } });
  }

  return fail("Acción no válida", 400);
};

export const config = { path: "/api/staff" };
