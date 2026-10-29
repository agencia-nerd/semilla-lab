// Identidad por stand: cultivos y campo Camposol. Se asigna por posición del stand.
export const STAND_COLORS = [
  { name: "Verde Camposol", hex: "#61A60E", fg: "#FFFFFF" },
  { name: "Arándano", hex: "#3D35D6", fg: "#FFFFFF" },
  { name: "Mandarina", hex: "#FF5B14", fg: "#FFFFFF" },
  { name: "Sol", hex: "#FFB81C", fg: "#0F0F0F" },
  { name: "Uva", hex: "#9B1B5A", fg: "#FFFFFF" },
  { name: "Riego", hex: "#0096D6", fg: "#FFFFFF" },
  { name: "Lima", hex: "#B2CC36", fg: "#0F0F0F" },
  { name: "Palta", hex: "#1E6B3A", fg: "#FFFFFF" },
  { name: "Langostino", hex: "#FF6B6B", fg: "#0F0F0F" },
  { name: "Tierra", hex: "#8A5A2B", fg: "#FFFFFF" },
];

export const colorAt = (i) => STAND_COLORS[((i % STAND_COLORS.length) + STAND_COLORS.length) % STAND_COLORS.length];
export const accentStyle = (i) => `--acc:${colorAt(i).hex};--acc-fg:${colorAt(i).fg}`;

// Pregunta opcional "lo más fuerte" (máx. 2). Las claves se guardan en el voto.
export const TAGS = [
  ["impacto", "Impacto"],
  ["tiempo", "Ahorro de tiempo"],
  ["facil", "Fácil de aplicar"],
  ["original", "Original"],
  ["personas", "Cuida a las personas"],
  ["sostenible", "Sostenible"],
];
