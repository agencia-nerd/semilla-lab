import { store, json, fail, readBody, cleanCode, CODE_RE, publicUser, limited } from "./_lib.mjs";

// Ingreso solo con el código de trabajador.
export default async (req) => {
  if (req.method !== "POST") return fail("Método no permitido", 405);
  if (limited(req, "login", 600)) return fail("Demasiados intentos, espera un momento", 429);
  const code = cleanCode((await readBody(req)).code);
  if (!CODE_RE.test(code)) return fail("Escribe tu código de trabajador");
  const s = store();
  const ref = await s.get(`codes/${code}`, { type: "json" });
  const user = ref && (await s.get(`users/${ref.phone}`, { type: "json" }));
  if (!user) return fail("No encontramos ese código. Regístrate primero.", 404);
  return json({ user: publicUser(user) });
};

export const config = { path: "/api/login" };
