/** Shared by the lazy 3D pile and the always-loaded stage/legend (keep this file dependency-free). */
export type SkillKey = { name: string; group: number; groupLabel: string };

/** Cap colour + label ink per skill group (cycled). */
export const CAP_COLORS = [
  { body: "#FFFFFF", ink: "#111318" },
  { body: "#FF8A4C", ink: "#111318" },
  { body: "#2A2D36", ink: "#F2F3F6" },
  { body: "#AEB4C2", ink: "#111318" },
];
