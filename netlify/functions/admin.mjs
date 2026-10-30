import { store, json, fail, readBody, getStands, getConfig, cleanName, maskPhone, prizeStatus, prizesFor, loadAll, cached, invalidate, PRIZES } from "./_lib.mjs";

// Meta: votar los stands necesarios para el último premio (10 → hot dog).
const GOAL = Math.max(...PRIZES.map((p) => p.at));

// En local (netlify dev) el PIN por defecto es "semilla2026"; en producción ADMIN_PIN es obligatorio.
const PIN = () => process.env.ADMIN_PIN || (process.env.NETLIFY_DEV ? "semilla2026" : null);
const MIN_VOTES_TO_RANK = 3;

async function snapshot(s) {
  const [stands, config, users, votes, claims, raffle] = await Promise.all([
    getStands(s), getConfig(s), loadAll(s, "users/"), loadAll(s, "votes/"), loadAll(s, "claims/"),
    s.get("raffle", { type: "json" }),
  ]);
  const claimsByPhone = Object.fromEntries(claims.map((c) => [c.key, c.value]));
  const usersByPhone = Object.fromEntries(users.map((u) => [u.key, u.value]));
  const agg = Object.fromEntries(stands.map((x) => [x.id, { total: 0, count: 0, dist: [0, 0, 0, 0, 0], tags: {}, comments: [] }]));
  const voters = [];
  for (const { key: phone, value } of votes) {
    const entries = Object.entries(value).filter(([id]) => agg[id]);
    for (const [id, v] of entries) {
      agg[id].total += v.stars; agg[id].count += 1; agg[id].dist[v.stars - 1] += 1;
      for (const t of v.tags || []) agg[id].tags[t] = (agg[id].tags[t] || 0) + 1;
      if (v.comment) agg[id].comments.push({ text: v.comment, stars: v.stars, at: v.at });
    }
    if (entries.length) voters.push({ phone, count: entries.length, votes: value });
  }
  for (const a of Object.values(agg)) a.comments.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  const ranking = stands
    .map((x) => ({ ...x, ...agg[x.id], avg: agg[x.id].count ? agg[x.id].total / agg[x.id].count : 0 }))
    .sort((a, b) =>
      (b.count >= MIN_VOTES_TO_RANK) - (a.count >= MIN_VOTES_TO_RANK) || b.avg - a.avg || b.count - a.count);
  const eligible = voters
    .filter((v) => v.count >= GOAL && usersByPhone[v.phone])
    .map((v) => ({ phone: v.phone, name: usersByPhone[v.phone].name, count: v.count }));
  // Premios: desbloqueados / canjeados por nivel.
  const countBy = Object.fromEntries(voters.map((v) => [v.phone, v.count]));
  const prizeStats = prizesFor(config).map((p) => ({ ...p, unlocked: 0, claimed: 0 }));
  const prizesByPhone = {};
  for (const phone of Object.keys(usersByPhone)) {
    const st = prizeStatus(countBy[phone] || 0, claimsByPhone[phone] || {}, config);
    prizesByPhone[phone] = st;
    st.forEach((z, i) => { if (z.unlocked) prizeStats[i].unlocked++; if (z.claimed) prizeStats[i].claimed++; });
  }
  return { stands, config, usersByPhone, voters, ranking, eligible, prizeStats, prizesByPhone, raffle: raffle || { winners: [] } };
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default async (req) => {
  const pin = PIN();
  if (!pin) return fail("Falta configurar la variable ADMIN_PIN en el servidor", 503);
  if (req.headers.get("x-admin-pin") !== pin) return fail("PIN incorrecto", 401);
  const s = store();
  const action = new URL(req.url).searchParams.get("action") || "summary";

  if (req.method === "GET" && action === "summary") {
    // Compartido 15 s entre el panel, la pantalla de proyección y varias pestañas abiertas.
    const data = await cached(s, "summary", 15_000, async () => {
      const snap = await snapshot(s);
      return {
      stats: {
        registered: Object.keys(snap.usersByPhone).length,
        voters: snap.voters.length,
        votes: snap.voters.reduce((n, v) => n + v.count, 0),
        eligible: snap.eligible.length,
      },
      ranking: snap.ranking, stands: snap.stands, config: snap.config, raffle: snap.raffle,
      eligible: snap.eligible.map((e) => ({ name: e.name, phoneMasked: maskPhone(e.phone), count: e.count })),
      prizeStats: snap.prizeStats,
      minVotesToRank: MIN_VOTES_TO_RANK,
      goal: GOAL,
      builtAt: new Date().toISOString(),
      };
    });
    return json(data);
  }

  if (req.method === "GET" && action === "export") {
    const snap = await snapshot(s);
    const ids = snap.stands.map((x) => x.id);
    const prizeList = prizesFor(snap.config);
    const header = ["nombre", "celular", "registrado", "stands_votados", `completo_${GOAL}`, ...prizeList.map((p) => `premio_${p.key}`), ...snap.stands.map((x) => x.name), ...snap.stands.map((x) => `${x.name} · comentario`)];
    const votesBy = Object.fromEntries(snap.voters.map((v) => [v.phone, v.votes]));
    const rows = Object.values(snap.usersByPhone).map((u) => {
      const v = votesBy[u.phone] || {};
      const n = ids.filter((id) => v[id]).length;
      const pz = snap.prizesByPhone[u.phone] || [];
      const pcell = (z) => (z.claimed ? `canjeado ${z.claimedAt}` : z.unlocked ? "pendiente" : "");
      return [u.name, u.phone, u.createdAt, n, n >= GOAL ? "si" : "no", ...pz.map(pcell), ...ids.map((id) => v[id]?.stars ?? ""), ...ids.map((id) => v[id]?.comment ?? "")];
    });
    const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="semilla-lab-votos.csv"' },
    });
  }

  if (req.method !== "POST") return fail("Acción no válida", 400);
  const body = await readBody(req);

  if (action === "stands") {
    if (!Array.isArray(body.stands) || !body.stands.length) return fail("Debe haber al menos un stand");
    const seen = new Set();
    const stands = body.stands.map((x, i) => {
      let id = String(x.id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 20) || `s${Date.now().toString(36)}${i}`;
      while (seen.has(id)) id += "x";
      seen.add(id);
      return { id, name: cleanName(x.name) || `Stand ${i + 1}`, team: cleanName(x.team), pitch: String(x.pitch || "").trim().slice(0, 200) };
    });
    await s.setJSON("stands", stands);
    await invalidate(s, "summary", "roster");
    return json({ stands });
  }

  if (action === "config") {
    const cur = await getConfig(s);
    const next = {
      votingOpen: typeof body.votingOpen === "boolean" ? body.votingOpen : cur.votingOpen,
      minForRaffle: Number.isInteger(body.minForRaffle) && body.minForRaffle > 0 ? body.minForRaffle : cur.minForRaffle,
    };
    await s.setJSON("config", next);
    await invalidate(s, "summary", "roster");
    return json({ config: next });
  }

  if (action === "draw") {
    const snap = await snapshot(s);
    const taken = new Set(snap.raffle.winners.map((w) => w.phone));
    const pool = snap.eligible.filter((e) => !taken.has(e.phone));
    if (!pool.length) return fail("No hay participantes elegibles disponibles");
    const pick = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
    const winner = { phone: pick.phone, name: pick.name, at: new Date().toISOString() };
    const raffle = { winners: [...snap.raffle.winners, winner] };
    await s.setJSON("raffle", raffle);
    await invalidate(s, "summary");
    return json({
      winner: { name: winner.name, phoneMasked: maskPhone(winner.phone), phone: winner.phone },
      pool: pool.map((p) => p.name),
      raffle,
    });
  }

  if (action === "deleteUser") {
    const phone = String(body.phone || "").replace(/\D/g, "");
    if (!/^9\d{8}$/.test(phone)) return fail("Celular inválido");
    await Promise.all([s.delete(`users/${phone}`), s.delete(`votes/${phone}`), s.delete(`claims/${phone}`)]);
    await invalidate(s, "summary", "roster");
    return json({ deleted: phone });
  }

  if (action === "resetRaffle") {
    await s.setJSON("raffle", { winners: [] });
    await invalidate(s, "summary");
    return json({ raffle: { winners: [] } });
  }

  return fail("Acción no válida", 400);
};

export const config = { path: "/api/admin" };
