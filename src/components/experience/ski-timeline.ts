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

/** Natural seconds to play a whole segment of each kind when gliding on its own. */
const SECONDS: Record<SegKind, number> = { intro: 2, summit: 5, descent: 14, lift: 11, end: 3.5 };
const REST_T = 0.32; // where a summit "rests" (arrived, card up)

/** Progress points where the run can rest: each summit (card shown) and the end. */
export const RESTS = SEGMENTS.flatMap((s, k) =>
  s.kind === "summit" ? [STARTS[k] + (REST_T * s.w) / TOTAL] : s.kind === "end" ? [0.995] : [],
);

/**
 * When the visitor stops scrolling mid-travel, glide on to the next (or previous) rest point at a
 * natural speed. Returns null when already resting (on a summit, in the intro or at the end).
 */
export function glideFrom(p: number, dir: 1 | -1): { to: number; seconds: number } | null {
  const { seg, t } = segmentAt(p);
  const resting =
    seg.kind === "intro" ||
    seg.kind === "end" ||
    (seg.kind === "summit" && t > SUMMIT_ARRIVE && t < SUMMIT_LEAVE);
  if (resting) return null;
  const to = dir > 0 ? RESTS.find((r) => r > p + 1e-4) : [...RESTS].reverse().find((r) => r < p - 1e-4);
  if (to === undefined) return null;
  // time = sum of each segment's share of the distance x its natural duration
  let seconds = 0;
  const [a, b] = p < to ? [p, to] : [to, p];
  SEGMENTS.forEach((s, k) => {
    const s0 = STARTS[k];
    const s1 = s0 + s.w / TOTAL;
    const overlap = Math.max(0, Math.min(b, s1) - Math.max(a, s0));
    seconds += (overlap / (s.w / TOTAL)) * SECONDS[s.kind];
  });
  return { to, seconds: Math.max(0.8, seconds) };
}

export type Card =
  | { kind: "intro" }
  | { kind: "entry"; index: number }
  | { kind: "travel"; via: "descent" | "lift" | "summit"; index: number; back?: boolean }
  | { kind: "end" };

export function cardAt(p: number, dir: 1 | -1 = 1): Card {
  const { seg, t } = segmentAt(p);
  if (seg.kind === "intro") return { kind: "intro" };
  if (seg.kind === "end") return { kind: "end" };
  if (seg.kind === "summit" && t > 0.1 && t < 0.92) return { kind: "entry", index: seg.i };
  // travelling back: the chip names where you're heading (the previous summit)
  if (dir < 0 && seg.kind === "lift") return { kind: "travel", via: "lift", index: seg.i, back: true };
  if (dir < 0 && seg.kind === "descent") return { kind: "travel", via: "descent", index: seg.i, back: true };
  // between summits: just a small chip saying where we are on the run
  if (seg.kind === "lift") return { kind: "travel", via: "lift", index: seg.i + 1 };
  if (seg.kind === "descent") return { kind: "travel", via: "descent", index: seg.i };
  return { kind: "travel", via: "summit", index: seg.i };
}
