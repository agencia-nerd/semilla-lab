// Servidor Node independiente (sin Netlify): sirve /public y monta las mismas
// funciones de netlify/functions en /api/*. Requiere Node 18+.
//
//   ADMIN_PIN=xxxx STORAGE_DIR=./data PORT=8080 node server/server.mjs
//
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 8080);
process.env.STORAGE_DIR ||= path.join(ROOT, "data");

if (!process.env.ADMIN_PIN) console.warn("⚠  ADMIN_PIN no está definido: el panel /admin no funcionará.");

// Carga las funciones y usa su config.path como ruta.
const FN_DIR = path.join(ROOT, "netlify", "functions");
const routes = new Map();
for (const f of await fs.readdir(FN_DIR)) {
  if (!f.endsWith(".mjs") || f.startsWith("_")) continue;
  const mod = await import(pathToFileURL(path.join(FN_DIR, f)).href);
  if (mod.config?.path) routes.set(mod.config.path, mod.default);
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon",
};
const SEC_HEADERS = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };

async function serveStatic(urlPath, res) {
  let rel = decodeURIComponent(urlPath);
  if (rel === "/admin") rel = "/admin/index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": "public, max-age=0, must-revalidate",
      ...SEC_HEADERS,
    });
    res.end(data);
  } catch {
    // SPA: cualquier ruta desconocida vuelve al index (la app usa ?stand= y ?v=).
    const index = await fs.readFile(path.join(PUBLIC, "index.html"));
    res.writeHead(200, { "content-type": TYPES[".html"], ...SEC_HEADERS }).end(index);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const handler = routes.get(url.pathname);
  if (!handler) return serveStatic(url.pathname, res);

  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", req.socket.remoteAddress || "local");
    const request = new Request(url, {
      method: req.method, headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const response = await handler(request);
    res.writeHead(response.status, { ...Object.fromEntries(response.headers), ...SEC_HEADERS });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: "Error interno" }));
  }
});

server.listen(PORT, () => {
  console.log(`Semilla Lab en http://localhost:${PORT}  ·  datos en ${process.env.STORAGE_DIR}`);
  console.log(`API: ${[...routes.keys()].join(", ")}`);
});
