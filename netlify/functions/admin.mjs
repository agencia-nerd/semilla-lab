import { store, json, fail, readBody, getStands, getConfig, cleanName, maskPhone, prizeStatus, prizesFor, loadAll, cached, invalidate, PRIZES, TICKET_MAX } from "./_lib.mjs";

// Meta: votar los stands necesarios para el último premio (10 → hot dog).
const GOAL = Math.max(...PRIZES.map((p) => p.at));

// En local (netlify dev) el PIN por defecto es "semilla2026"; en producción ADMIN_PIN es obligatorio.
const PIN = () => process.env.ADMIN_PIN || (process.env.NETLIFY_DEV ? "semilla2026" : null);
// Sin mínimo de votos: compite todo stand con al menos 1 voto (los de 0 votos quedan al final, sin puesto).
const MIN_VOTES_TO_RANK = 1;

async function snapshot(s) {
  const [stands, config, users, votes, claims, tickets, raffle] = await Promise.all([
    getStands(s), getConfig(s), loadAll(s, "users/"), loadAll(s, "votes/"), loadAll(s, "claims/"), loadAll(s, "tickets/"),
    s.get("raffle", { type: "json" }),
  ]);
  const claimsByPhone = Object.fromEntries(claims.map((c) => [c.key, c.value]));
  const ticketsByPhone = Object.fromEntries(tickets.map((t) => [t.key, t.value]));
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
  // Favorito del público (criterio de Luciana). Se ordena por:
  // 1) mayor promedio (comparado exacto, sin redondear: total_a * votos_b vs total_b * votos_a)
  // 2) si empatan, más calificaciones de 5 estrellas · 3) si persiste, más votantes.
  // Si coinciden en promedio, notas 5 y votantes, es empate: comparten el puesto (tie: true).
  const cmp = (a, b) => {
    const ra = a.count >= MIN_VOTES_TO_RANK, rb = b.count >= MIN_VOTES_TO_RANK;
    if (ra !== rb) return ra ? -1 : 1;
    return (b.total * a.count - a.total * b.count) || (b.dist[4] - a.dist[4]) || (b.count - a.count);
  };
  const ranking = stands
    .map((x) => ({ ...x, ...agg[x.id], avg: agg[x.id].count ? agg[x.id].total / agg[x.id].count : 0, fives: agg[x.id].dist[4] }))
    .sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, "es"));
  ranking.forEach((r, i) => {
    const prev = ranking[i - 1];
    r.pos = prev && cmp(prev, r) === 0 ? prev.pos : i + 1;
    r.tie = r.count >= MIN_VOTES_TO_RANK && !!((prev && cmp(prev, r) === 0) || (ranking[i + 1] && cmp(ranking[i + 1], r) === 0));
  });
  const eligible = voters
    .filter((v) => v.count >= GOAL && usersByPhone[v.phone])
    .map((v) => ({ phone: v.phone, name: usersByPhone[v.phone].name, count: v.count }));
  // Premios: desbloqueados / canjeados por nivel.
  const countBy = Object.fromEntries(voters.map((v) => [v.phone, v.count]));
  const prizeStats = prizesFor(config).map((p) => ({ ...p, unlocked: 0, claimed: 0, tickets: 0, ticketMax: TICKET_MAX }));
  const prizesByPhone = {};
  for (const phone of Object.keys(usersByPhone)) {
    const st = prizeStatus(countBy[phone] || 0, claimsByPhone[phone] || {}, config, ticketsByPhone[phone] || {});
    prizesByPhone[phone] = st;
    st.forEach((z, i) => { if (z.unlocked) prizeStats[i].unlocked++; if (z.claimed) prizeStats[i].claimed++; if (z.ticket) prizeStats[i].tickets++; });
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
    const header = ["nombre", "codigo_trabajador", "celular", "registrado", "stands_votados", `completo_${GOAL}`, ...prizeList.map((p) => `premio_${p.key}`), ...prizeList.map((p) => `numero_${p.key}`), ...snap.stands.map((x) => x.name), ...snap.stands.map((x) => `${x.name} · comentario`)];
    const votesBy = Object.fromEntries(snap.voters.map((v) => [v.phone, v.votes]));
    const rows = Object.values(snap.usersByPhone).map((u) => {
      const v = votesBy[u.phone] || {};
      const n = ids.filter((id) => v[id]).length;
      const pz = snap.prizesByPhone[u.phone] || [];
      const pcell = (z) => (z.claimed ? `canjeado ${z.claimedAt}` : z.unlocked ? "pendiente" : "");
      return [u.name, u.code || "", u.phone !== u.code ? u.phone : "", u.createdAt, n, n >= GOAL ? "si" : "no", ...pz.map(pcell), ...pz.map((z) => z.ticket ?? ""), ...ids.map((id) => v[id]?.stars ?? ""), ...ids.map((id) => v[id]?.comment ?? "")];
    });
    const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    return new Response(csv, {
      // no-store: sin esto la caché de SiteGround/navegador devolvía un CSV viejo (de las pruebas).
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="semilla-lab-votos.csv"', "cache-control": "no-store" },
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
      const logo = /^\/assets\/stands\/[\w.-]+$/.test(x.logo || "") ? x.logo : "";
      return { id, name: cleanName(x.name) || `Stand ${i + 1}`, team: cleanName(x.team), pitch: String(x.pitch || "").trim().slice(0, 200), ...(logo && { logo }) };
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
    const phone = String(body.phone || body.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!/^[A-Z0-9-]{3,20}$/.test(phone)) return fail("Participante inválido");
    // Libera también sus números de canje para que puedan volver a asignarse.
    const [tickets, u] = await Promise.all([s.get(`tickets/${phone}`, { type: "json" }).then((t) => t || {}), s.get(`users/${phone}`, { type: "json" })]);
    await Promise.all([
      s.delete(`users/${phone}`), s.delete(`votes/${phone}`), s.delete(`claims/${phone}`), s.delete(`tickets/${phone}`),
      ...Object.entries(tickets).map(([k, n]) => s.delete(`ticket/${k}/${n}`)),
      ...(u?.code ? [s.delete(`codes/${u.code}`)] : []),
    ]);
    await invalidate(s, "summary", "roster");
    return json({ deleted: phone });
  }

  // Reset total (pedido explícito desde el panel, con doble confirmación): borra votos, participantes,
  // códigos, premios/canjes, números de canje y sorteo. Mantiene los stands y reabre la votación.
  if (action === "resetAll") {
    if (body.confirm !== "RESETEAR") return fail("Falta la confirmación");
    let deleted = 0;
    for (const prefix of ["votes/", "users/", "codes/", "claims/", "tickets/", "ticket/", "cache/"]) {
      const { blobs } = await s.list({ prefix });
      for (let i = 0; i < blobs.length; i += 50) {
        await Promise.all(blobs.slice(i, i + 50).map((x) => s.delete(x.key)));
      }
      deleted += blobs.length;
    }
    const cur = await getConfig(s);
    const config = { ...cur, votingOpen: true };
    await Promise.all([s.setJSON("raffle", { winners: [] }), s.setJSON("config", config)]);
    await invalidate(s, "summary", "roster");
    return json({ ok: true, deleted, config });
  }

  if (action === "resetRaffle") {
    await s.setJSON("raffle", { winners: [] });
    await invalidate(s, "summary");
    return json({ raffle: { winners: [] } });
  }

  return fail("Acción no válida", 400);
};

export const config = { path: "/api/admin" };
