// Almacenamiento en disco con la misma interfaz que usamos de Netlify Blobs
// (get / setJSON / delete / list). Se activa definiendo STORAGE_DIR.
// Un archivo JSON por clave; escritura atómica (tmp + rename).
import { promises as fs } from "node:fs";
import path from "node:path";

const enc = (key) => encodeURIComponent(key) + ".json";
const dec = (file) => decodeURIComponent(file.slice(0, -5));

export function fileStore(dir) {
  const ready = fs.mkdir(dir, { recursive: true });
  const file = (key) => path.join(dir, enc(key));

  return {
    async get(key, { type } = {}) {
      await ready;
      try {
        const raw = await fs.readFile(file(key), "utf8");
        return type === "json" ? JSON.parse(raw) : raw;
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async setJSON(key, value) {
      await ready;
      const tmp = `${file(key)}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value));
      await fs.rename(tmp, file(key));
    },
    async delete(key) {
      await ready;
      await fs.rm(file(key), { force: true });
    },
    async list({ prefix = "" } = {}) {
      await ready;
      const names = await fs.readdir(dir);
      const blobs = names
        .filter((n) => n.endsWith(".json"))
        .map(dec)
        .filter((k) => k.startsWith(prefix))
        .map((key) => ({ key }));
      return { blobs };
    },
  };
}
