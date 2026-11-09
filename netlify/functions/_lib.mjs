import { getStore } from "@netlify/blobs";
import { fileStore } from "./_filestore.mjs";

// En Netlify: Netlify Blobs. En servidor propio: archivos JSON en STORAGE_DIR.
let disk = null;
export const store = () =>
  process.env.STORAGE_DIR
    ? (disk ||= fileStore(process.env.STORAGE_DIR))
    : getStore({ name: "semilla", consistency: "strong" });

export const PHONE_RE = /^9\d{8}$/;

// Los 10 finalistas de SemillaLab 2026, en el orden oficial de stands (`team` = categoría).
// Los id se mantienen aunque cambie el orden: los votos y los QR impresos van por id.
export const DEFAULT_STANDS = [
  { id: "s01", name: "Coti AI", team: "Cat. 1 · Crecimiento comercial y experiencia del cliente", pitch: "Cotizaciones a clientes en minutos con inteligencia artificial.", logo: "/assets/stands/s01.webp" },
  { id: "s02", name: "Inventory Value Optimization", team: "Cat. 1 · Crecimiento comercial y experiencia del cliente", pitch: "Inventario optimizado para liberar capital y no perder ventas.", logo: "/assets/stands/s02.webp" },
  { id: "s09", name: "Eureka", team: "Cat. 3 · Excelencia productiva y calidad", pitch: "Una mejora de proceso que eleva la productividad y la calidad del producto.", logo: "/assets/stands/s09.webp" },
  { id: "s10", name: "Avocado Rewash", team: "Cat. 3 · Excelencia productiva y calidad", pitch: "Relavado de palta que recupera fruta y asegura calidad e inocuidad.", logo: "/assets/stands/s10.webp" },
  { id: "s03", name: "Handpack Evolution", team: "Cat. 2 · Eficiencia y sostenibilidad", pitch: "Empaque manual rediseñado para ganar velocidad y reducir desperdicio.", logo: "/assets/stands/s03.webp" },
  { id: "s04", name: "Geocampos IA", team: "Cat. 2 · Eficiencia y sostenibilidad", pitch: "Mapas del fundo con IA para decidir riego, nutrición y cosecha por lote.", logo: "/assets/stands/s04.webp" },
  { id: "s05", name: "Hydratech", team: "Cat. 2 · Eficiencia y sostenibilidad", pitch: "Tecnología para usar cada gota de agua de riego con precisión.", logo: "/assets/stands/s05.webp" },
  { id: "s06", name: "Mr. Pack", team: "Cat. 2 · Eficiencia y sostenibilidad", pitch: "Empaque más eficiente y sostenible, con menos material y menos costo.", logo: "/assets/stands/s06.webp" },
  { id: "s07", name: "Smart Track IOT", team: "Cat. 2 · Eficiencia y sostenibilidad", pitch: "Trazabilidad de cada lote en tiempo real con sensores IoT, del campo al cliente.", logo: "/assets/stands/s07.webp" },
  { id: "s08", name: "Protime", team: "Cat. 2 · Eficiencia y sostenibilidad", pitch: "Control de tiempos de operación para producir más en menos horas.", logo: "/assets/stands/s08.webp" },
];

// Premios: uno por nivel, se acumulan, cada uno se canjea una sola vez. El último nivel es 10 (todos los stands, hot dog).
export const PRIZES = [
  { key: "canchita", name: "Canchita", at: 3 },
  { key: "gaseosa", name: "Gaseosa", at: 5 },
  { key: "helado", name: "Helado", at: 8 },
  { key: "pancho", name: "Hot Dog", at: 10 },
];

// Lista de premios vigente (se deja como función por si en el futuro dependen de la configuración).
export const prizesFor = () => PRIZES;

// Votos válidos (de stands que existen).
export const voteCount = (votes, stands) => stands.filter((s) => votes?.[s.id]).length;

// Estado de premios de una persona: bloqueado / listo / canjeado, y su número de canje.
export function prizeStatus(count, claims = {}, config, tickets = {}) {
  return prizesFor(config).map((p) => ({
    ...p,
    unlocked: count >= p.at,
    claimed: !!claims[p.key],
    claimedAt: claims[p.key]?.at || null,
    missing: Math.max(0, p.at - count),
    ticket: tickets[p.key] || null,
  }));
}

// Números de canje: cada premio desbloqueado recibe un número al azar del 1 al TICKET_MAX,
// único por premio (cada puesto tiene su hoja impresa del 1 al 500 y tacha el número del vale).
// La unicidad la garantiza una clave por número creada con onlyIfNew: si dos personas sacan
// el mismo número a la vez, solo una lo obtiene y la otra prueba con otro.
export const TICKET_MAX = 500;

async function takeTicket(s, prize, phone) {
  const claim = async (n) => (await s.setJSON(`ticket/${prize}/${n}`, { phone, at: new Date().toISOString() }, { onlyIfNew: true }))?.modified !== false;
  for (let i = 0; i < 25; i++) {
    const n = 1 + Math.floor(Math.random() * TICKET_MAX);
    if (await claim(n)) return n;
  }
  // Quedan pocos libres: se eligen entre los que faltan.
  const { blobs } = await s.list({ prefix: `ticket/${prize}/` });
  const used = new Set(blobs.map((b) => Number(b.key.split("/").pop())));
  const free = Array.from({ length: TICKET_MAX }, (_, i) => i + 1).filter((n) => !used.has(n));
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  for (const n of free) if (await claim(n)) return n;
  return null; // se acabaron los números
}

// Asigna (una sola vez) los números de los premios desbloqueados y devuelve todos los de la persona.
export async function ensureTickets(s, phone, count, config) {
  const key = `tickets/${phone}`;
  const tickets = (await s.get(key, { type: "json" })) || {};
  const missing = prizesFor(config).filter((p) => count >= p.at && !tickets[p.key]);
  if (!missing.length) return tickets;
  for (const p of missing) {
    const n = await takeTicket(s, p.key, phone);
    if (n) tickets[p.key] = n;
  }
  await s.setJSON(key, tickets);
  return tickets;
}

// Pregunta opcional "lo más fuerte" (debe coincidir con public/palette.js).
export const TAG_KEYS = ["impacto", "tiempo", "facil", "original", "personas", "sostenible"];

export const DEFAULT_CONFIG = { votingOpen: true, minForRaffle: 10 };

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

export const fail = (message, status = 400) => json({ error: message }, status);

export async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}

export async function getStands(s = store()) {
  const stands = await s.get("stands", { type: "json" });
  return Array.isArray(stands) ? stands : DEFAULT_STANDS;
}

export async function getConfig(s = store()) {
  return { ...DEFAULT_CONFIG, ...((await s.get("config", { type: "json" })) || {}) };
}

export const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 80);
export const cleanPhone = (v) => String(v || "").replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, "");

export async function authUser(req, s = store()) {
  const auth = req.headers.get("authorization") || "";
  const [phone, token] = auth.replace(/^Bearer\s+/i, "").split(":");
  if (!ID_RE.test(phone || "") || !token) return null;
  const user = await s.get(`users/${phone}`, { type: "json" });
  return user && user.token === token ? user : null;
}

export const publicUser = (u) => ({ name: u.name, phone: u.phone, code: u.code || u.phone, token: u.token });

// Código de trabajador: letras y números (se guarda en mayúsculas, sin espacios).
export const cleanCode = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
export const CODE_RE = /^[A-Z0-9-]{3,20}$/;

// Reserva un código para una persona (id). Devuelve false si ya lo usa otra.
export async function claimCode(s, code, phone) {
  const r = await s.setJSON(`codes/${code}`, { phone, at: new Date().toISOString() }, { onlyIfNew: true });
  if (r?.modified !== false) return true;
  const cur = await s.get(`codes/${code}`, { type: "json" });
  return cur?.phone === phone;
}

// Rate limit simple en memoria por instancia (suficiente para un evento interno).
// Ojo: en el evento cientos de personas comparten el WiFi y salen con la MISMA IP,
// por eso los límites por IP son altos y el de votos se aplica por persona (id).
const hits = new Map();
export function limited(req, key, max = 20, windowMs = 60_000, id = null) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "local";
  const k = `${key}:${id || ip}`;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}

// Identificador interno de cada persona (campo `phone`, clave users/<id>): el código de trabajador.
// Los registros antiguos usan su celular; ambos cumplen ID_RE.
export const ID_RE = /^[A-Z0-9-]{3,20}$/;
// Etiqueta para el staff/panel: el código; si la persona es antigua (celular), el celular enmascarado.
export const maskPhone = (p, code) => code || (PHONE_RE.test(p) ? `${p.slice(0, 1)}** *** ${p.slice(-3)}` : p);

// Lee todos los documentos de un prefijo (en lotes de 50 en paralelo).
export async function loadAll(s, prefix) {
  const { blobs } = await s.list({ prefix });
  const out = [];
  for (let i = 0; i < blobs.length; i += 50) {
    const chunk = await Promise.all(blobs.slice(i, i + 50).map((b) => s.get(b.key, { type: "json" })));
    chunk.forEach((v, j) => v && out.push({ key: blobs[i + j].key.slice(prefix.length), value: v }));
  }
  return out;
}

// Caché compartida para lecturas pesadas (resumen del panel, lista del staff).
// Capa 1: memoria de la instancia (3 s). Capa 2: un documento en el store, compartido
// entre todas las instancias (ttl). Así 10 pantallas consultando cada pocos segundos
// cuestan ~1 lectura cada una, y el recálculo completo ocurre como mucho 1 vez por ttl.
const mem = new Map();
export async function cached(s, key, ttl, build) {
  const now = Date.now();
  const m = mem.get(key);
  if (m && now - m.at < Math.min(3000, ttl)) return m.data;
  const doc = await s.get(`cache/${key}`, { type: "json" }).catch(() => null);
  if (doc && now - doc.at < ttl) { mem.set(key, doc); return doc.data; }
  const data = await build();
  const fresh = { at: Date.now(), data };
  mem.set(key, fresh);
  await s.setJSON(`cache/${key}`, fresh);
  return data;
}
export async function invalidate(s, ...keys) {
  for (const k of keys) mem.delete(k);
  await Promise.all(keys.map((k) => s.delete(`cache/${k}`)));
}

// Ajusta un documento cacheado sin recalcularlo (p. ej. tras un canje). Si no hay caché, no hace nada.
export async function patchCached(s, key, fn) {
  const doc = await s.get(`cache/${key}`, { type: "json" }).catch(() => null);
  if (!doc) return;
  doc.data = fn(doc.data);
  mem.set(key, doc);
  await s.setJSON(`cache/${key}`, doc);
}
