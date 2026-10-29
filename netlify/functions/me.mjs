import { store, json, fail, authUser, getConfig } from "./_lib.mjs";

export default async (req) => {
  const s = store();
  const user = await authUser(req, s);
  if (!user) return fail("Sesión inválida", 401);
  const [votes, config] = await Promise.all([s.get(`votes/${user.phone}`, { type: "json" }), getConfig(s)]);
  const v = votes || {};
  return json({ user: { name: user.name, phone: user.phone }, votes: v, count: Object.keys(v).length, config });
};

export const config = { path: "/api/me" };
