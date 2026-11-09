import { store, json, fail, readBody, cleanName, cleanCode, CODE_RE, publicUser, limited } from "./_lib.mjs";

// Registro con nombre + código de trabajador. El código es la identidad de la persona:
// si ya estaba registrado, entra directo con sus votos.
export default async (req) => {
  if (req.method !== "POST") return fail("Método no permitido", 405);
  if (limited(req, "register", 600)) return fail("Demasiados intentos, espera un momento", 429);
  const body = await readBody(req);
  const name = cleanName(body.name);
  const code = cleanCode(body.code);
  if (name.length < 3 || !/\s/.test(name)) return fail("Escribe tu nombre y apellido");
  if (!CODE_RE.test(code)) return fail("Escribe tu código de trabajador");
  if (!body.consent) return fail("Acepta el uso de tus datos para la votación y los premios");

  const s = store();
  const user = { name, code, phone: code, token: crypto.randomUUID().replace(/-/g, ""), createdAt: new Date().toISOString() };
  const created = await s.setJSON(`codes/${code}`, { phone: code, at: user.createdAt }, { onlyIfNew: true });
  if (created?.modified === false) {
    const ref = await s.get(`codes/${code}`, { type: "json" });
    const existing = ref && (await s.get(`users/${ref.phone}`, { type: "json" }));
    if (existing) return json({ user: publicUser(existing), existing: true });
  }
  await s.setJSON(`users/${code}`, user);
  return json({ user: publicUser(user), existing: false }, 201);
};

export const config = { path: "/api/register" };
