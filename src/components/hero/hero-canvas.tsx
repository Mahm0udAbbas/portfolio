"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { trackAsset } from "@/lib/asset-gate";
import { PRELOADER_DONE, isPreloading } from "@/lib/lenis";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// WebGL only on the client; the chunk + model load while the preloader runs.
const ToysCanvas = dynamic(() => import("./toys-canvas"), { ssr: false });

/** Wires the toys scene to the page: preloader gate, scroll progress, pointer, visibility. */
export function HeroCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const entered = useRef(false);
  const resolveReady = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(true);
  const reduced = useReducedMotion();

  // Hold the preloader until the model is in (asset-gate also has its own timeout).
  useEffect(() => {
    trackAsset(new Promise<void>((r) => (resolveReady.current = r)));
  }, []);
  const onReady = useCallback(() => resolveReady.current?.(), []);

  // Toys pop in when the preloader hands over.
  useEffect(() => {
    const enter = () => (entered.current = true);
    if (!isPreloading()) enter();
    window.addEventListener(PRELOADER_DONE, enter);
    return () => window.removeEventListener(PRELOADER_DONE, enter);
  }, []);

  // Pointer for parallax
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  // Pause rendering when the hero is off-screen
  useEffect(() => {
    const section = wrap.current?.closest("section");
    if (!section) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" });
    io.observe(section);
    return () => io.disconnect();
  }, []);

  // Scroll: progress for the scatter + fade the copy out
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.create({
        trigger: "#hero",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => (progress.current = self.progress),
      });
      gsap.to("[data-hero-copy]", {
        autoAlpha: 0,
        y: -80,
        ease: "none",
        scrollTrigger: { trigger: "#hero", start: "top top", end: "30% top", scrub: true },
      });
    });
  });

  return (
    <div ref={wrap} aria-hidden="true" className="absolute inset-0">
      <ToysCanvas
        active={active}
        progress={progress}
        pointer={pointer}
        entered={entered}
        reduced={reduced}
        onReady={onReady}
      />
    </div>
  );
}
