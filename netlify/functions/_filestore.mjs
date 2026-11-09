// Almacenamiento en disco con la misma interfaz que usamos de Netlify Blobs
// (get / setJSON / delete / list). Se activa definiendo STORAGE_DIR.
// Un archivo JSON por clave; escritura atómica (tmp + rename).
import { promises as fs } from "node:fs";
import path from "node:path";

const enc = (key) => encodeURIComponent(key) + ".json";
const dec = (file) => decodeURIComponent(file.slice(0, -5));
let seq = 0;

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
    async setJSON(key, value, { onlyIfNew } = {}) {
      await ready;
      // Creación exclusiva (como onlyIfNew de Netlify Blobs): falla si el archivo ya existe.
      if (onlyIfNew) {
        try { await fs.writeFile(file(key), JSON.stringify(value), { flag: "wx" }); return { modified: true }; }
        catch (e) { if (e.code === "EEXIST") return { modified: false }; throw e; }
      }
      // Nombre temporal único (dos escrituras de la misma clave en el mismo milisegundo no deben chocar).
      const tmp = `${file(key)}.${process.pid}.${Date.now()}.${++seq}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value));
      for (let i = 0; ; i++) {
        try { await fs.rename(tmp, file(key)); break; }
        catch (e) {
          // En Windows el rename falla (EPERM/EBUSY) si otro pedido está leyendo el archivo: se reintenta.
          if (i < 5 && (e.code === "EPERM" || e.code === "EBUSY" || e.code === "EACCES")) { await new Promise((r) => setTimeout(r, 10 * (i + 1))); continue; }
          await fs.rm(tmp, { force: true });
          throw e;
        }
      }
      return { modified: true };
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
