"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { getLenis } from "@/lib/lenis";
import { takeProjectOrigin } from "@/lib/project-origin";

gsap.registerPlugin(useGSAP);

const FULL = "inset(0px 0px 0px 0px round 0px)";
const rectToInset = (r: DOMRect) =>
  `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px round 24px)`;

/**
 * Full-screen overlay for an intercepted /projects/[slug] route.
 * Grows out of the clicked card (clip-path), and shrinks back into it on close (Esc / button) before router.back().
 */
export function ProjectOverlay({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  useGSAP(
    () => {
      const el = panel.current!;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const from = takeProjectOrigin();

      if (from && !reduced) {
        gsap.fromTo(el, { clipPath: rectToInset(from) }, { clipPath: FULL, duration: 0.85, ease: "expo.inOut" });
        gsap.from("article > *", { autoAlpha: 0, y: 28, stagger: 0.06, duration: 0.7, ease: "power3.out", delay: 0.5 });
      } else {
        gsap.from(el, { autoAlpha: 0, duration: 0.3 });
      }
      closeBtn.current?.focus({ preventScroll: true });
    },
    { scope: panel },
  );

  // Lock page scroll while open
  useEffect(() => {
    getLenis()?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      getLenis()?.start();
      document.documentElement.style.overflow = "";
    };
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = panel.current;
    const card = document.querySelector<HTMLElement>(`[data-project-card="${slug}"]`);
    const r = card?.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onScreen = r && r.bottom > 0 && r.top < window.innerHeight;

    if (!el || reduced || !onScreen) {
      gsap.to(el, { autoAlpha: 0, duration: 0.25, onComplete: () => router.back() });
      return;
    }
    gsap
      .timeline({ onComplete: () => router.back() })
      .to(el.querySelectorAll("article > *"), { autoAlpha: 0, y: -12, duration: 0.25, stagger: 0.02 })
      .to(el, { clipPath: rectToInset(r), duration: 0.7, ease: "expo.inOut" }, 0.1);
  }, [router, slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-title"
      data-lenis-prevent
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-surface"
    >
      <button
        ref={closeBtn}
        type="button"
        onClick={close}
        className="fixed right-4 top-4 z-10 rounded-md border border-line bg-bg/80 px-3 py-2 font-mono text-sm backdrop-blur hover:border-accent hover:text-accent sm:right-8 sm:top-6"
      >
        <span className="text-muted">[esc]</span> close
      </button>
      {children}
    </div>
  );
}
