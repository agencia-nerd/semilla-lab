// Identidad por stand dentro de la paleta de campaña Semilla Lab 2026.
// Los stands de una misma categoría (campo `team`) comparten color; sin categoría, se asigna por posición.
export const STAND_COLORS = [
  { name: "Petróleo", ink: "#027D78", hex: "#027D78", fg: "#FFFFFF" },
  { name: "Verde", ink: "#128A43", hex: "#1CAF58", fg: "#12302C" },
  { name: "Naranja", ink: "#C9561A", hex: "#FC843C", fg: "#12302C" },
  { name: "Lima", ink: "#6F7F06", hex: "#E6F079", fg: "#12302C" },
  { name: "Camposol", ink: "#4A800B", hex: "#62A70F", fg: "#12302C" },
  { name: "Sol", ink: "#9A6B00", hex: "#FFC629", fg: "#12302C" },
  { name: "Celeste", ink: "#1C7686", hex: "#3AA6B9", fg: "#12302C" },
  { name: "Bosque", ink: "#0E5A20", hex: "#0E5A20", fg: "#FFFFFF" },
  { name: "Coral", ink: "#C2412F", hex: "#F2705E", fg: "#12302C" },
  { name: "Tierra", ink: "#8A5A2B", hex: "#8A5A2B", fg: "#FFFFFF" },
  { name: "Morado", ink: "#6B3FA0", hex: "#7B4BB7", fg: "#FFFFFF" },
];

// Colores por categoría, en el orden en que aparecen (como en la gráfica de finalistas: 1 naranja, 2A verde, 2B bosque, 3 morado).
const CATEGORY_COLORS = [2, 1, 7, 10, 0, 5, 6, 8, 4, 9, 3].map((k) => STAND_COLORS[k]);
let byIndex = [];
// Registra la lista de stands vigente para colorear por categoría.
export function setStands(stands = []) {
  const cats = [];
  byIndex = stands.map((s) => {
    const c = (s.team || "").trim();
    if (!c) return null;
    if (!cats.includes(c)) cats.push(c);
    return CATEGORY_COLORS[cats.indexOf(c) % CATEGORY_COLORS.length];
  });
}
const byPosition = (i) => STAND_COLORS[((i % STAND_COLORS.length) + STAND_COLORS.length) % STAND_COLORS.length];
export const colorAt = (i) => byIndex[i] || byPosition(i);
export const accentStyle = (i) => `--acc:${colorAt(i).hex};--acc-fg:${colorAt(i).fg};--acc-ink:${colorAt(i).ink}`;
// ink = versión del color legible sobre fondo blanco/crema (para números y textos).

// Pregunta opcional "lo más fuerte" (máx. 2). Las claves se guardan en el voto.
export const TAGS = [
  ["impacto", "Impacto"],
  ["tiempo", "Ahorro de tiempo"],
  ["facil", "Fácil de aplicar"],
  ["original", "Original"],
  ["personas", "Cuida a las personas"],
  ["sostenible", "Sostenible"],
];

// Premios (los niveles vienen del servidor; aquí solo su identidad visual).
export const PRIZE_STYLE = {
  canchita: { ink: "#9A6B00", hex: "#FFC629", fg: "#12302C", img: "/assets/prizes/canchita.webp", unit: "Válido por 1 unidad" },
  gaseosa: { ink: "#C9561A", hex: "#FC843C", fg: "#12302C", img: "/assets/prizes/gaseosa.webp", unit: "Válido por 1 unidad" },
  helado: { ink: "#6F7F06", hex: "#E6F079", fg: "#12302C", img: "/assets/prizes/helado.webp", unit: "Válido por 1 unidad" },
  pancho: { ink: "#128A43", hex: "#1CAF58", fg: "#12302C", img: "/assets/prizes/pancho.webp", unit: "Válido por 1 unidad" },
};
export const prizeStyle = (key) => PRIZE_STYLE[key] || { hex: "#027D78", ink: "#027D78", fg: "#FFFFFF", img: "", unit: "" };
