import { store, json, fail, authUser, getConfig, getStands, voteCount, prizeStatus, ensureTickets } from "./_lib.mjs";

export default async (req) => {
  const s = store();
  const user = await authUser(req, s);
  if (!user) return fail("Sesión inválida", 401);
  const [votes, claims, config, stands] = await Promise.all([
    s.get(`votes/${user.phone}`, { type: "json" }),
    s.get(`claims/${user.phone}`, { type: "json" }),
    getConfig(s),
    getStands(s),
  ]);
  const v = votes || {};
  const count = voteCount(v, stands);
  const tickets = await ensureTickets(s, user.phone, count, config);
  return json({ user: { name: user.name, phone: user.phone }, votes: v, count, config, prizes: prizeStatus(count, claims || {}, config, tickets) });
};

export const config = { path: "/api/me" };
