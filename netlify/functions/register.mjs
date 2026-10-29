import { store, json, fail, readBody, cleanName, cleanPhone, PHONE_RE, publicUser, limited } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return fail("Método no permitido", 405);
  if (limited(req, "register", 100)) return fail("Demasiados intentos, espera un momento", 429);
  const body = await readBody(req);
  const name = cleanName(body.name);
  const phone = cleanPhone(body.phone);
  if (name.length < 3 || !/\s/.test(name)) return fail("Escribe tu nombre y apellido");
  if (!PHONE_RE.test(phone)) return fail("El celular debe tener 9 dígitos y empezar con 9");
  if (!body.consent) return fail("Acepta el uso de tus datos para el sorteo");

  const s = store();
  const existing = await s.get(`users/${phone}`, { type: "json" });
  if (existing) return json({ user: publicUser(existing), existing: true });

  const user = { name, phone, token: crypto.randomUUID().replace(/-/g, ""), createdAt: new Date().toISOString() };
  await s.setJSON(`users/${phone}`, user);
  return json({ user: publicUser(user), existing: false }, 201);
};

export const config = { path: "/api/register" };
