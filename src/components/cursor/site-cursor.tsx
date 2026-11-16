"use client";

import { useEffect, useRef, useState } from "react";

/** Fired by the footer bug swarm when a bug is squashed under the pointer. */
export const CURSOR_CATCH = "cursor:catch";

const CLICKABLE = "a[href], button:not(:disabled), [role='button'], label[for], summary, select";
const TEXT_ENTRY = "input, textarea, [contenteditable='true']";

/**
 * The logo's accent cursor bar, trailing the native pointer the way it trails the `>`
 * prompt in the mark. It widens over anything clickable. Inside a `[data-cursor]` zone
 * (the footer) it becomes a bug-catching reticle that locks on when a bug is under the pointer.
 * Mouse and trackpad only; skipped for touch and reduced motion.
 */
export function SiteCursor() {
  const root = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !calm.matches);
    update();
    fine.addEventListener("change", update);
    calm.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      calm.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!enabled || !el) return;
    const html = document.documentElement;
    html.dataset.siteCursor = "";
    const target = { x: -100, y: -100 };
    const bar = { x: -100, y: -100 };
    let overEl: Element | null = null;
    let lastMove = 0;
    let visible = false;
    let frame = 0;
    let last = performance.now();

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX;
      target.y = e.clientY;
      overEl = e.target as Element | null;
      lastMove = performance.now();
      if (!visible) {
        visible = true;
        bar.x = target.x;
        bar.y = target.y;
        el.dataset.visible = "";
      }
    };
    const hide = () => {
      visible = false;
      delete el.dataset.visible;
    };
    const catchBug = () => {
      el.dataset.caught = "";
      window.setTimeout(() => delete el.dataset.caught, 380);
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const zone = overEl?.closest<HTMLElement>("[data-cursor]");
      const mode = zone
        ? zone.dataset.cursor === "lock" ? "lock" : "hunt"
        : overEl?.closest(TEXT_ENTRY) ? "text"
          : overEl?.closest(CLICKABLE) ? "link" : "default";
      if (el.dataset.mode !== mode) el.dataset.mode = mode;
      const idle = now - lastMove > 650;
      if (idle !== "idle" in el.dataset) {
        if (idle) el.dataset.idle = "";
        else delete el.dataset.idle;
      }
      // The bar trails a little behind; the reticle sits exactly on the pointer.
      const k = 1 - Math.exp(-22 * dt);
      bar.x += (target.x - bar.x) * k;
      bar.y += (target.y - bar.y) * k;
      el.style.setProperty("--bar-x", `${bar.x}px`);
      el.style.setProperty("--bar-y", `${bar.y}px`);
      el.style.setProperty("--x", `${target.x}px`);
      el.style.setProperty("--y", `${target.y}px`);
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    window.addEventListener(CURSOR_CATCH, catchBug);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      delete html.dataset.siteCursor;
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener(CURSOR_CATCH, catchBug);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div ref={root} className="site-cursor" aria-hidden="true">
      <span className="site-cursor__bar" />
      <span className="site-cursor__reticle">
        <i /><i /><i /><i />
        <b />
      </span>
    </div>
  );
}
