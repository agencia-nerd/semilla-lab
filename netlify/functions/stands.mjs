import { store, json, getStands, getConfig } from "./_lib.mjs";

export default async () => {
  const s = store();
  const [stands, config] = await Promise.all([getStands(s), getConfig(s)]);
  return json({ stands, config });
};

export const config = { path: "/api/stands" };
