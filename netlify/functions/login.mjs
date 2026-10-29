import { store, json, fail, readBody, cleanPhone, PHONE_RE, publicUser, limited } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return fail("Método no permitido", 405);
  if (limited(req, "login", 30)) return fail("Demasiados intentos, espera un momento", 429);
  const phone = cleanPhone((await readBody(req)).phone);
  if (!PHONE_RE.test(phone)) return fail("El celular debe tener 9 dígitos y empezar con 9");
  const user = await store().get(`users/${phone}`, { type: "json" });
  if (!user) return fail("No encontramos ese celular. Regístrate primero.", 404);
  return json({ user: publicUser(user) });
};

export const config = { path: "/api/login" };
