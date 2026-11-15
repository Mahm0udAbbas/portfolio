/**
 * Pure timing for the ski run (no three.js — safe to import from always-loaded components).
 * Path data comes from blender/build_ski_run.py.
 */
import PATH from "./ski-path.json";

export const RUN = {
  checkpoints: PATH.checkpoints as number[],
  jump: PATH.jump as { ramp_start: number; lip: number; land: number },
  finish: PATH.finish as number,
  step: PATH.step as number,
};

/** Scroll progress (0..1) → distance along the run, with dwells at each checkpoint so cards can be read. */
const [c0, c1, c2] = RUN.checkpoints;
const KEYS: [number, number][] = [
  [0, 0],
  [0.1, 5],
  [0.2, c0],
  [0.28, c0 + 0.6], // dwell: Civil Engineering
  [0.38, RUN.jump.lip],
  [0.45, RUN.jump.land],
  [0.53, c1],
  [0.61, c1 + 0.6], // dwell: ITI
  [0.8, c2],
  [0.87, RUN.finish], // hockey stop at Nami Tech
  [1, RUN.finish], // camera pulls back to the wide shot
];
export const WIDE_FROM = 0.87;

export function progressToS(p: number) {
  for (let i = 1; i < KEYS.length; i++) {
    const [p1, s1] = KEYS[i];
    if (p <= p1) {
      const [p0, s0] = KEYS[i - 1];
      return s0 + ((s1 - s0) * (p - p0)) / Math.max(p1 - p0, 1e-6);
    }
  }
  return RUN.finish;
}
