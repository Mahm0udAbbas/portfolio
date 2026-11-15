"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { BugsApi } from "./bugs-canvas";

const BugsCanvas = dynamic(() => import("./bugs-canvas"), { ssr: false });

export const BUGS_COUNT = "bugs:count";

type Toast = { id: number; x: number; y: number };
let toastId = 0;

/**
 * 3D bugs crawling over the footer. The canvas ignores pointer events so footer links keep working;
 * this layer hit-tests the bugs itself (click on a bug = squash, and the click never reaches the link).
 */
export function BugsLayer() {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<BugsApi | null>(null);
  const reduced = useReducedMotion();
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const zone = wrap.current?.parentElement;
    if (!zone) return;
    const nearIo = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    const viewIo = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    nearIo.observe(zone);
    viewIo.observe(zone);

    const local = (e: MouseEvent) => {
      const r = zone.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      api.current?.point(p);
      zone.style.cursor = api.current?.over(p.x, p.y) ? "crosshair" : "";
    };
    const leave = () => {
      api.current?.point(null);
      zone.style.cursor = "";
    };
    // Capture phase: a hit squashes the bug and swallows the click before any link sees it.
    const click = (e: MouseEvent) => {
      const p = local(e);
      if (api.current?.hit(p.x, p.y)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    zone.addEventListener("pointermove", move);
    zone.addEventListener("pointerleave", leave);
    zone.addEventListener("click", click, true);
    return () => {
      nearIo.disconnect();
      viewIo.disconnect();
      zone.removeEventListener("pointermove", move);
      zone.removeEventListener("pointerleave", leave);
      zone.removeEventListener("click", click, true);
    };
  }, []);

  const onFix = useCallback((x: number, y: number) => {
    const el = wrap.current;
    if (!el) return;
    // canvas coords (centre origin, y up) → footer px
    const id = ++toastId;
    setToasts((t) => [...t, { id, x: x + el.clientWidth / 2, y: el.clientHeight / 2 - y }]);
    setTimeout(() => setToasts((t) => t.filter((q) => q.id !== id)), 1400);
  }, []);
  const onCount = useCallback((n: number) => {
    window.dispatchEvent(new CustomEvent(BUGS_COUNT, { detail: n }));
  }, []);

  return (
    <div ref={wrap} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {near && <BugsCanvas active={active} reduced={reduced} apiRef={api} onFix={onFix} onCount={onCount} />}
      {toasts.map((t) => (
        <span
          key={t.id}
          className="bug-toast absolute -translate-x-1/2 whitespace-nowrap font-mono text-xs text-accent"
          style={{ left: t.x, top: t.y }}
        >
          {"// bug fixed ✓"}
        </span>
      ))}
    </div>
  );
}

/** "N bugs remaining" — live from the swarm. */
export function BugCounter() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const on = (e: Event) => setN((e as CustomEvent<number>).detail);
    window.addEventListener(BUGS_COUNT, on);
    return () => window.removeEventListener(BUGS_COUNT, on);
  }, []);
  return (
    <span aria-live="polite">
      {n === null ? (
        <>scanning for bugs</>
      ) : n === 0 ? (
        <>
          <span className="text-accent">0</span> bugs remaining — ship it 🚀
        </>
      ) : (
        <>
          <span className="text-accent">{n}</span> bug{n === 1 ? "" : "s"} remaining · click to fix
        </>
      )}
      <span className="cursor-blink">_</span>
    </span>
  );
}
