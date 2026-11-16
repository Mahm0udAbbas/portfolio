export type WalkChapter = {
  kind: "intro" | "travel" | "entry" | "end";
  index: number;
};
export const WALK_LENGTH = 92;
export const WALK_CORNER = 84;
/** Scroll progress before the first step and after the last chapter. */
export const WALK_INTRO_END = 0.06;
export const WALK_END = 0.95;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);

/** Each chapter has a travel interval followed by a stationary reading interval. */
export function walkTimeline(
  progress: number,
  count: number,
): WalkChapter & { distance: number } {
  const p = clamp(progress);
  if (count < 1 || p < WALK_INTRO_END) return { kind: "intro", index: 0, distance: 0 };
  if (p >= 0.84) {
    const t = clamp((p - 0.84) / 0.11);
    return {
      kind: p >= WALK_END ? "end" : "travel",
      index: count - 1,
      distance: 72 + 20 * ease(t),
    };
  }
  const step = ((p - 0.06) / 0.78) * count;
  const index = Math.min(count - 1, Math.floor(step));
  const local = step - index;
  const to = 14 + 58 * (count === 1 ? 1 : index / (count - 1));
  const from =
    index === 0 ? 0 : 14 + 58 * (count === 1 ? 0 : (index - 1) / (count - 1));
  return {
    kind: local < 0.65 ? "travel" : "entry",
    index,
    distance: from + (to - from) * ease(clamp(local / 0.65)),
  };
}

export function chapterProgress(index: number, count: number) {
  return 0.06 + (0.78 * (index + 0.66)) / Math.max(1, count);
}

/** Find the first checkpoint crossed, even when one input skips several chapters. */
export function crossedCheckpoint(from: number, to: number, count: number) {
  const order = Array.from({ length: count }, (_, index) => index);
  if (to < from) order.reverse();
  return order.find(index => {
    const p = chapterProgress(index, count);
    return to > from ? p > from + 1e-7 && p <= to : p < from - 1e-7 && p >= to;
  }) ?? null;
}

/** Sidewalk, then a rounded left corner. Coordinates use Three.js Y-up. */
export function walkPath(distance: number): {
  x: number;
  z: number;
  yaw: number;
} {
  const d = Math.min(WALK_LENGTH, Math.max(0, distance));
  if (d <= WALK_CORNER) return { x: -21 + d, z: 5.05, yaw: Math.PI / 2 };
  const radius = 2;
  const arc = Math.min((d - WALK_CORNER) / radius, Math.PI / 2);
  return {
    x: 63 + radius * Math.sin(arc),
    z: 3.05 + radius * Math.cos(arc) - Math.max(0, d - WALK_CORNER - Math.PI),
    yaw: Math.PI / 2 + arc,
  };
}

/**
 * Critically damped follow with a speed cap (Unity's SmoothDamp). Velocity stays
 * continuous when the target jumps, so discrete wheel notches become one glide.
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  maxSpeed: number,
  dt: number,
): { value: number; velocity: number } {
  const time = Math.max(0.0001, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const limit = maxSpeed * time;
  const change = Math.min(limit, Math.max(-limit, current - target));
  const clamped = current - change;
  const temp = (velocity + omega * change) * dt;
  let nextVelocity = (velocity - omega * temp) * decay;
  let value = clamped + (change + temp) * decay;
  // Never overshoot the target.
  if (target - current > 0 === value > target) {
    value = target;
    nextVelocity = 0;
  }
  return { value, velocity: nextVelocity };
}
