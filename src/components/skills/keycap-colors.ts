/** Shared by the lazy 3D pile and the always-loaded stage/legend (keep this file dependency-free). */
export type SkillKey = { name: string; group: number; groupLabel: string };

/** Cap colour + label ink per skill group (cycled). */
export const CAP_COLORS = [
  { body: "#ECE8DD", ink: "#24242C" },
  { body: "#C6FF3D", ink: "#0B0B0F" },
  { body: "#24242C", ink: "#ECE8DD" },
  { body: "#9A98A6", ink: "#0B0B0F" },
];
