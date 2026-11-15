/**
 * Hand-off between a clicked project card and the overlay that opens from it:
 * the card stores its on-screen rect, the overlay grows out of that rect.
 */
let origin: DOMRect | null = null;

export const setProjectOrigin = (r: DOMRect) => {
  origin = r;
};

/** Read once — a later direct navigation shouldn't reuse a stale rect. */
export const takeProjectOrigin = () => {
  const r = origin;
  origin = null;
  return r;
};

/** Tints for generated placeholder previews, cycled by project index. */
export const PROJECT_TINTS = ["#c6ff3d", "#3dd6ff", "#a78bfa", "#ffb03d", "#ff5d8f", "#4dffb8"];
