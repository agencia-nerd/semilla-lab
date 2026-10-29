import { getStore } from "@netlify/blobs";
import { fileStore } from "./_filestore.mjs";

// En Netlify: Netlify Blobs. En servidor propio: archivos JSON en STORAGE_DIR.
let disk = null;
export const store = () =>
  process.env.STORAGE_DIR
    ? (disk ||= fileStore(process.env.STORAGE_DIR))
    : getStore({ name: "semilla", consistency: "strong" });

export const PHONE_RE = /^9\d{8}$/;

export const DEFAULT_STANDS = [
  { id: "s01", name: "Riego que escucha", team: "Operaciones Agrícolas", pitch: "Sensores de humedad que ajustan el riego por turno y reducen consumo de agua." },
  { id: "s02", name: "Cosecha sin papel", team: "Campo · Arándano", pitch: "Registro de jabas desde el celular, sin planillas ni doble digitación." },
  { id: "s03", name: "Ruta corta a planta", team: "Logística", pitch: "Rutas de transporte reordenadas para bajar tiempos de campo a empaque." },
  { id: "s04", name: "Frío inteligente", team: "Cadena de Frío", pitch: "Alertas tempranas de temperatura en cámaras para cuidar la fruta." },
  { id: "s05", name: "Empaque en flujo", team: "Planta de Empaque", pitch: "Rediseño de la línea para eliminar cuellos de botella en clamshells." },
  { id: "s06", name: "Mantenimiento a tiempo", team: "Mantenimiento", pitch: "Plan predictivo de tractores basado en horas de uso reales." },
  { id: "s07", name: "Menos merma, más fruta", team: "Calidad", pitch: "Clasificación visual que detecta defectos antes del empaque." },
  { id: "s08", name: "Inducción en 1 día", team: "Gestión Humana", pitch: "Onboarding guiado con videos cortos para nuevos colaboradores." },
  { id: "s09", name: "Energía que rinde", team: "Sostenibilidad", pitch: "Medición de consumo eléctrico por área para atacar el desperdicio." },
  { id: "s10", name: "Compra en un clic", team: "Abastecimiento", pitch: "Solicitudes de insumos aprobadas en el día, con trazabilidad." },
];

// Pregunta opcional "lo más fuerte" (debe coincidir con public/palette.js).
export const TAG_KEYS = ["impacto", "tiempo", "facil", "original", "personas", "sostenible"];

export const DEFAULT_CONFIG = { votingOpen: true, minForRaffle: 5 };

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
  if (!PHONE_RE.test(phone || "") || !token) return null;
  const user = await s.get(`users/${phone}`, { type: "json" });
  return user && user.token === token ? user : null;
}

export const publicUser = (u) => ({ name: u.name, phone: u.phone, token: u.token });

// Rate limit simple en memoria por instancia (suficiente para un evento interno).
const hits = new Map();
export function limited(req, key, max = 20, windowMs = 60_000) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}

export const maskPhone = (p) => `${p.slice(0, 1)}** *** ${p.slice(-3)}`;
