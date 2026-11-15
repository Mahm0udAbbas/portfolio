"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { lockScroll } from "@/lib/lenis";

gsap.registerPlugin(useGSAP);

const DURATION = 1.1;
const EASE = "power3.inOut";

const findCard = (slug: string) => document.querySelector<HTMLElement>(`[data-project-card="${slug}"]`);

/** The card's on-screen box (includes the stack's scale), as left/top/width/height. */
const boxOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};
const FULL = () => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });

/**
 * Overlay for the intercepted /projects/[slug] route.
 * Open: the clicked card becomes the front face of a 3D card that flips 180° while growing to fill the screen;
 * the project details are on the back face. Close (Esc / button): exact reverse, landing back in the stack.
 * The page underneath never scrolls, so the section and stack state are preserved.
 */
export function ProjectOverlay({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const flipper = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const state = useRef<"opening" | "open" | "closing">("opening");
  const flipped = useRef(false); // true when the open animation ran (vs. plain fade)

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useGSAP(
    () => {
      const card = findCard(slug);
      const f = flipper.current!;
      const b = back.current!;

      const done = () => {
        state.current = "open";
        // Flatten the 3D transform once open so text renders crisply and the back face scrolls normally.
        gsap.set(f, { rotateY: 0, borderRadius: 0, ...FULL() });
        gsap.set(b, { rotateY: 0 });
        gsap.set(front.current, { autoAlpha: 0 });
        b.style.overflowY = "auto";
        gsap.fromTo(closeBtn.current, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.3 });
        closeBtn.current?.focus({ preventScroll: true });
      };

      if (!card || reduced()) {
        gsap.set(f, { ...FULL() });
        gsap.set(front.current, { autoAlpha: 0 });
        gsap.fromTo(root.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, onComplete: done });
        gsap.set(backdrop.current, { opacity: 1 });
        return;
      }

      // Front face = a clone of the card, at its natural size, scaled like it is in the stack.
      flipped.current = true;
      const box = boxOf(card);
      const clone = card.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-project-card");
      clone.removeAttribute("href");
      clone.style.cssText = `width:${card.offsetWidth}px;height:${card.offsetHeight}px;transform:scale(${
        box.width / card.offsetWidth
      });transform-origin:0 0;pointer-events:none;`;
      front.current!.replaceChildren(clone);
      card.style.visibility = "hidden";

      gsap.set(f, { ...box, rotateY: 0, borderRadius: 24 });
      gsap.set(b, { rotateY: 180 });

      gsap
        .timeline({ onComplete: done })
        .to(backdrop.current, { opacity: 1, duration: DURATION * 0.8, ease: "power1.out" }, 0)
        .to(f, { ...FULL(), rotateY: 180, borderRadius: 0, duration: DURATION, ease: EASE }, 0)
        // a little lift toward the viewer mid-flip
        .to(f, { z: 160, duration: DURATION / 2, ease: "power2.out", yoyo: true, repeat: 1 }, 0);

      return () => {
        card.style.visibility = "";
      };
    },
    { scope: root },
  );

  // Lock page scroll while open (keeps the section/stack exactly where it was)
  useEffect(() => lockScroll(), []);

  const close = useCallback(() => {
    if (state.current !== "open") return;
    state.current = "closing";
    const f = flipper.current!;
    const b = back.current!;
    const card = findCard(slug);

    if (!card || !flipped.current || reduced()) {
      if (card) card.style.visibility = "";
      gsap.to(root.current, { autoAlpha: 0, duration: 0.25, onComplete: () => router.back() });
      return;
    }

    // Restore the 3D setup, then play the open animation in reverse.
    gsap.to(closeBtn.current, { autoAlpha: 0, duration: 0.15 });
    b.style.overflowY = "hidden";
    gsap
      .timeline({
        onComplete: () => {
          card.style.visibility = "";
          router.back();
        },
      })
      .to(b, { scrollTop: 0, duration: Math.min(0.5, b.scrollTop / 2000), ease: "power2.out" })
      .add(() => {
        gsap.set(f, { rotateY: 180 });
        gsap.set(b, { rotateY: 180 });
        gsap.set(front.current, { autoAlpha: 1 });
      })
      .addLabel("flip")
      .to(f, { ...boxOf(card), rotateY: 0, borderRadius: 24, duration: DURATION, ease: EASE }, "flip")
      .to(f, { z: 160, duration: DURATION / 2, ease: "power2.out", yoyo: true, repeat: 1 }, "flip")
      .to(backdrop.current, { opacity: 0, duration: DURATION * 0.8, ease: "power1.in" }, `flip+=${DURATION * 0.2}`);
  }, [router, slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-title"
      className="fixed inset-0 z-[60] [perspective:2200px]"
    >
      <div ref={backdrop} aria-hidden="true" className="absolute inset-0 bg-[#111318]/55 opacity-0" onClick={close} />

      <div ref={flipper} className="fixed left-0 top-0 h-dvh w-screen [transform-style:preserve-3d]">
        {/* Front: the card */}
        <div ref={front} aria-hidden="true" className="absolute inset-0 overflow-hidden [backface-visibility:hidden]" />

        {/* Back: project details. Inner width is fixed to the viewport so nothing reflows while it grows. */}
        <div
          ref={back}
          data-lenis-prevent
          className="absolute inset-0 flex items-start justify-center overflow-hidden overscroll-contain rounded-[inherit] bg-surface [backface-visibility:hidden]"
        >
          <div className="w-screen min-h-full shrink-0">
            {children}
          </div>
        </div>
      </div>

      {/* Outside the 3D card so `fixed` stays pinned to the viewport. Hidden until the flip lands. */}
      <button
        ref={closeBtn}
        type="button"
        onClick={close}
        className="invisible absolute right-4 top-4 z-10 rounded-md border border-line bg-bg/80 px-3 py-2 font-mono text-sm backdrop-blur hover:border-accent hover:text-accent-strong sm:right-8 sm:top-6"
      >
        <span className="text-muted">[esc]</span> close
      </button>
    </div>
  );
}
