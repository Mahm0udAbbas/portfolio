/**
 * Scroll timeline for the ski run (pure — no three.js, safe for always-loaded components).
 * The pinned section's progress (0..1) is split into weighted segments:
 * intro → summit 1 → descent (with jump) → lift → summit 2 → descent → lift → summit 3 → end.
 * At each summit the card shows and the camera dives in and back out.
 */
export type SegKind = "intro" | "summit" | "descent" | "lift" | "end";
export type Segment = { kind: SegKind; i: number; w: number };

export const SEGMENTS: Segment[] = [
  { kind: "intro", i: 0, w: 0.3 },
  { kind: "summit", i: 0, w: 0.8 },
  { kind: "descent", i: 0, w: 1.1 },
  { kind: "lift", i: 0, w: 0.7 },
  { kind: "summit", i: 1, w: 0.8 },
  { kind: "descent", i: 1, w: 1.1 },
  { kind: "lift", i: 1, w: 0.7 },
  { kind: "summit", i: 2, w: 0.8 },
  { kind: "end", i: 2, w: 0.45 },
];
export const CHECKPOINTS = 3;

const TOTAL = SEGMENTS.reduce((a, s) => a + s.w, 0);
const STARTS = SEGMENTS.reduce<number[]>((acc, s, k) => [...acc, k ? acc[k - 1] + SEGMENTS[k - 1].w / TOTAL : 0], []);

export function segmentAt(p: number) {
  const q = Math.min(Math.max(p, 0), 0.99999);
  let k = SEGMENTS.length - 1;
  while (k > 0 && STARTS[k] > q) k--;
  const t = (q - STARTS[k]) / (SEGMENTS[k].w / TOTAL);
  return { index: k, seg: SEGMENTS[k], t: Math.min(Math.max(t, 0), 1) };
}

/** Summit dwell: arrive (0–0.15), stand + camera dive (0.15–0.85), leave (0.85–1). */
export const SUMMIT_ARRIVE = 0.15;
export const SUMMIT_LEAVE = 0.85;

/** 0 = high camera, 1 = close-up, rising and falling smoothly through the summit dwell. */
export function zoomAt(kind: SegKind, t: number) {
  if (kind !== "summit") return 0;
  const u = (t - SUMMIT_ARRIVE) / (SUMMIT_LEAVE - SUMMIT_ARRIVE);
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 1.4;
}

export type Card =
  | { kind: "intro" }
  | { kind: "entry"; index: number }
  | { kind: "travel"; via: "descent" | "lift" | "summit"; index: number }
  | { kind: "end" };

export function cardAt(p: number): Card {
  const { seg, t } = segmentAt(p);
  if (seg.kind === "intro") return { kind: "intro" };
  if (seg.kind === "end") return { kind: "end" };
  if (seg.kind === "summit" && t > 0.1 && t < 0.92) return { kind: "entry", index: seg.i };
  // between summits: just a small chip saying where we are on the run
  if (seg.kind === "lift") return { kind: "travel", via: "lift", index: seg.i + 1 };
  if (seg.kind === "descent") return { kind: "travel", via: "descent", index: seg.i };
  return { kind: "travel", via: "summit", index: seg.i };
}
