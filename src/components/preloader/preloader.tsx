"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { site } from "@/content/site";
import { Logo } from "@/components/brand/logo";
import { assetProgress, assetsSettled, trackPageBasics } from "@/lib/asset-gate";
import { PRELOADER_DONE } from "@/lib/lenis";

gsap.registerPlugin(useGSAP);

const VISITED_KEY = "ma:visited";
const FLY_SIZE = 120; // px — size of the logo in the centre before it flies

/**
 * Terminal preloader → logo → flies into the header with a bounce.
 * Mounted in the root layout, so it runs on every full page load but never on client-side navigation.
 * Skippable with any key / click. Returning visitors get a faster run.
 */
export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const html = document.documentElement;
      const main = document.querySelector("main");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let returning = false;
      try {
        returning = localStorage.getItem(VISITED_KEY) === "1";
        localStorage.setItem(VISITED_KEY, "1");
      } catch {
        /* storage blocked — treat as first visit */
      }

      history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
      trackPageBasics();

      const lines = q<HTMLElement>("[data-line]");
      const [bar] = q<HTMLElement>("[data-bar]");
      const [pct] = q<HTMLElement>("[data-pct]");
      const [term] = q<HTMLElement>("[data-term]");
      const [fly] = q<HTMLElement>("[data-fly]");
      const stroke = fly.querySelector("[data-logo-stroke]");
      const cursor = fly.querySelector("[data-logo-cursor]");

      // ── 1. Typing ────────────────────────────────────────────────
      const type = gsap.timeline({ paused: true });
      site.preloader.forEach((line, i) => {
        const c = { n: 0 };
        const cmd = lines[i].querySelector<HTMLElement>("[data-cmd]")!;
        const out = lines[i].querySelector<HTMLElement>("[data-out]");
        type.set(lines[i], { autoAlpha: 1 }).to(c, {
          n: line.cmd.length,
          duration: line.cmd.length * 0.028,
          ease: "none",
          onUpdate: () => {
            cmd.textContent = line.cmd.slice(0, Math.round(c.n));
          },
        });
        if (out) type.set(out, { autoAlpha: 1 }, "+=0.12");
        type.to({}, { duration: 0.16 });
      });

      // Progress bar = the slower of "typing" and "real assets", eased so it never jumps.
      let shown = 0;
      const tickBar = () => {
        const target = Math.min(type.progress(), assetProgress());
        shown += (target - shown) * 0.18;
        if (target === 1 && shown > 0.995) shown = 1;
        bar.style.transform = `scaleX(${shown})`;
        pct.textContent = `${Math.round(shown * 100)}%`;
      };
      gsap.ticker.add(tickBar);

      // ── 2. Outro: terminal → logo → fly → bounce ─────────────────
      let outroStarted = false;
      const runOutro = () => {
        if (outroStarted) return;
        outroStarted = true;
        window.removeEventListener("keydown", skip);
        window.removeEventListener("pointerdown", skip);
        type.progress(1);

        const targetSvg = document.querySelector<SVGSVGElement>("[data-logo-target] svg");
        const finish = () => {
          gsap.ticker.remove(tickBar);
          html.removeAttribute("data-preloading");
          if (main) gsap.set(main, { clearProps: "opacity,transform,visibility" });
          window.dispatchEvent(new Event(PRELOADER_DONE));
          setGone(true);
        };

        if (reduced || !targetSvg) {
          gsap.to(el, { autoAlpha: 0, duration: 0.4, delay: 0.3, onComplete: finish });
          return;
        }

        const r = targetSvg.getBoundingClientRect();
        const s = r.width / FLY_SIZE;
        const dx = r.left + r.width / 2 - window.innerWidth / 2;
        const dy = r.top + r.height / 2 - window.innerHeight / 2;
        const rise = Math.min(90, window.innerHeight * 0.1); // how far above the header it arcs

        gsap.set(stroke, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.set(cursor, { scale: 0, transformOrigin: "50% 50%" });
        gsap.set(fly, { autoAlpha: 1 });

        const FLY = 0.55; // rise phase
        const DROP = 0.75; // bounce-down phase
        const contact = FLY + DROP * 0.3636; // first ground contact of bounce.out

        gsap
          .timeline({ onComplete: finish })
          .to(term, { scale: 0.25, autoAlpha: 0, duration: 0.45, ease: "power3.in" })
          .to(stroke, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, "-=0.2")
          .to(cursor, { scale: 1, duration: 0.35, ease: "back.out(3)" }, "-=0.12")
          // anticipation squash before take-off
          .to(fly, { scaleX: 1.12, scaleY: 0.84, duration: 0.14, ease: "power2.out" }, "+=0.12")
          .addLabel("fly")
          .to(el, { backgroundColor: "rgba(238,240,244,0)", duration: 0.7, ease: "power1.out" }, "fly")
          .to(fly, { x: dx, duration: FLY + DROP * 0.5, ease: "power2.inOut" }, "fly")
          .to(fly, { scaleX: s, scaleY: s, duration: contact, ease: "power2.inOut" }, "fly")
          .to(fly, { y: dy - rise, duration: FLY, ease: "power2.out" }, "fly")
          .to(fly, { y: dy, duration: DROP, ease: "bounce.out" }, `fly+=${FLY}`)
          // squash on impact, then elastic settle
          .to(fly, { scaleX: s * 1.25, scaleY: s * 0.72, duration: 0.07, ease: "power1.out" }, `fly+=${contact}`)
          .to(fly, { scaleX: s, scaleY: s, duration: 0.9, ease: "elastic.out(1.1, 0.3)" }, `fly+=${contact + 0.07}`)
          .fromTo(
            main,
            { autoAlpha: 0, y: 28 },
            { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out" },
            "fly+=0.35",
          );
      };

      const skip = () => runOutro();

      if (reduced) {
        type.progress(1);
        runOutro();
        return;
      }

      window.addEventListener("keydown", skip);
      window.addEventListener("pointerdown", skip);

      type.timeScale(returning ? 2.4 : 1).play();
      const typed = new Promise<void>((resolve) => type.eventCallback("onComplete", () => resolve()));
      Promise.all([typed, assetsSettled(8000)]).then(runOutro);

      return () => {
        window.removeEventListener("keydown", skip);
        window.removeEventListener("pointerdown", skip);
        gsap.ticker.remove(tickBar);
      };
    },
    { scope: root },
  );

  if (gone) return null;

  return (
    <div
      ref={root}
      id="preloader"
      role="status"
      aria-live="polite"
      aria-label="Loading portfolio"
      className="fixed inset-0 z-[100] bg-bg"
    >
      <div
        data-term
        className="term-dark absolute inset-x-4 top-1/2 mx-auto max-w-xl -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-surface font-mono text-sm shadow-[0_30px_80px_-20px_rgba(17,19,24,0.45)]"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-2.5 rounded-full bg-accent" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="ml-3 text-xs text-muted">{site.handle}@portfolio: ~</span>
        </div>

        <div className="min-h-44 space-y-2 px-5 py-4">
          {site.preloader.map((line, i) => (
            <div key={i} data-line className="invisible">
              <span className="text-accent-strong">❯</span> <span data-cmd />
              {line.out ? (
                <div data-out className="invisible pl-4 text-muted">
                  {line.out}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-5 py-3 text-xs text-muted">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div data-bar className="h-full origin-left scale-x-0 bg-accent" />
          </div>
          <span data-pct className="w-9 text-right tabular-nums text-fg">
            0%
          </span>
        </div>
        <p className="px-5 pb-3 text-[11px] text-muted/70">press any key to skip</p>
      </div>

      <div
        data-fly
        className="invisible absolute inset-0 m-auto text-fg"
        style={{ width: FLY_SIZE, height: FLY_SIZE }}
      >
        <Logo className="size-full" blink={false} />
      </div>
    </div>
  );
}
