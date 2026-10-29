import { store, json, fail, readBody, authUser, getStands, getConfig, limited, TAG_KEYS } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return fail("Método no permitido", 405);
  if (limited(req, "vote", 60)) return fail("Demasiados intentos, espera un momento", 429);
  const s = store();
  const user = await authUser(req, s);
  if (!user) return fail("Sesión inválida", 401);
  const [config, stands] = await Promise.all([getConfig(s), getStands(s)]);
  if (!config.votingOpen) return fail("La votación está cerrada", 403);

  const { standId, stars, tags } = await readBody(req);
  const n = Number(stars);
  if (!stands.some((x) => x.id === standId)) return fail("Stand no encontrado", 404);
  if (!Number.isInteger(n) || n < 1 || n > 5) return fail("Elige de 1 a 5 estrellas");

  const key = `votes/${user.phone}`;
  const votes = (await s.get(key, { type: "json" })) || {};
  const cleanTags = Array.isArray(tags) ? [...new Set(tags.filter((t) => TAG_KEYS.includes(t)))].slice(0, 2) : [];
  votes[standId] = { stars: n, tags: cleanTags, at: new Date().toISOString() };
  await s.setJSON(key, votes);
  return json({ votes, count: Object.keys(votes).length, minForRaffle: config.minForRaffle });
};

export const config = { path: "/api/vote" };
