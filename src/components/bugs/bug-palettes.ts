/**
 * Real-world colourways for the footer bugs. Each part of the model is coloured by role:
 *   shell → *_Shell                  spots → *_Spot*, *_Mark*
 *   head  → *_Head, *_Thorax, *_Waist   legs → *_Leg_*, *_Antenna*, *_Jaw*
 *   eyes  → *_Eye*
 * (Mirrored in blender/build_bugs.py for the preview render.)
 */
export type Role = "shell" | "spots" | "head" | "legs" | "eyes";
export type Palette = { name: string } & Record<Role, string>;

export const BUG_PALETTES = {
  Ladybug: [
    { name: "seven-spot ladybird", shell: "#D3201B", spots: "#121214", head: "#151517", legs: "#151517", eyes: "#F4F1EA" },
    { name: "harlequin ladybird", shell: "#EE7418", spots: "#121214", head: "#151517", legs: "#151517", eyes: "#F4F1EA" },
    { name: "22-spot ladybird", shell: "#F5C21A", spots: "#121214", head: "#151517", legs: "#2A2318", eyes: "#F4F1EA" },
  ],
  Ant: [
    { name: "fire ant", shell: "#6E2410", spots: "#6E2410", head: "#B4421C", legs: "#8E3416", eyes: "#111113" },
    { name: "red wood ant", shell: "#16161A", spots: "#16161A", head: "#1B1B1F", legs: "#3A1F14", eyes: "#0D0D0F" },
  ],
  Spider: [
    { name: "black widow", shell: "#17171C", spots: "#E3242B", head: "#17171C", legs: "#1C1C22", eyes: "#3E3E48" },
    { name: "orange orb-weaver", shell: "#F08A1E", spots: "#6B3410", head: "#8A5528", legs: "#7A4A22", eyes: "#121214" },
  ],
} satisfies Record<string, Palette[]>;

/** Red wood ants have a red thorax but black head — per-part override on top of the role colour. */
export const PART_OVERRIDES: Record<string, Record<string, string>> = {
  "red wood ant": { Thorax: "#A93C19", Waist: "#A93C19" },
};

export function roleOf(part: string): Role | null {
  if (part === "Shell") return "shell";
  if (/^(Spot|Mark)/.test(part)) return "spots";
  if (/^(Head|Thorax|Waist)$/.test(part)) return "head";
  if (/^(Leg_|Antenna|Jaw)/.test(part)) return "legs";
  if (/^Eye/.test(part)) return "eyes";
  return null;
}
