"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Experience } from "@/content/site";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { getLenis, scrollToSection } from "@/lib/lenis";
import { CHECKPOINTS, cardAt, glideFrom, type Card } from "./ski-timeline";
import { SnowSplats, type SnowSplatsHandle } from "./snow-splats";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SkiCanvas = dynamic(() => import("./ski-canvas"), { ssr: false });

/**
 * Experience as a ski run, summit to summit: the section pins for ~500vh; scrolling carries the skier
 * down each piste and up each chairlift. At every summit the card appears and the camera dives in. Phones (<1024px) and reduced motion get `fallback`
 * (the git-log timeline) — which is also what's server-rendered, so the content is always in the HTML.
 */
export function SkiRunStage({ entries, fallback }: { entries: Experience[]; fallback: React.ReactNode }) {
  const reduced = useReducedMotion();
  const small = useMediaQuery("(max-width: 1023px)");
  if (small !== false || reduced) return <>{fallback}</>;
  return <SkiRun entries={entries} />;
}

const keyOf = (c: Card) =>
  c.kind === "entry" ? `e${c.index}` : c.kind === "travel" ? `t${c.via}${c.index}${c.back ? "b" : ""}` : c.kind;
const TRAVEL = { descent: "skiing down from", lift: "chairlift up to", summit: "at the summit of" } as const;
const TRAVEL_BACK = { descent: "climbing back to", lift: "chairlift down to", summit: "at the summit of" } as const;

function SkiRun({ entries }: { entries: Experience[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const splats = useRef<SnowSplatsHandle>(null);
  const onSplat = useCallback((x: number, y: number, size: number) => splats.current?.splat(x, y, size), []);
  const progress = useRef(0);
  const dir = useRef<1 | -1>(1); // which way the visitor is scrolling (cards fade the other way going back)
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [card, setCard] = useState<Card>({ kind: "intro" }); // where the scroll is
  const [shown, setShown] = useState<Card>({ kind: "intro" }); // what the panel currently displays
  const count = Math.min(entries.length, CHECKPOINTS);

  // Swapping from the server-rendered timeline changes the page height → re-measure everything.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const nearIo = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "1200px 0px" });
    const viewIo = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    nearIo.observe(el);
    viewIo.observe(el);
    return () => {
      nearIo.disconnect();
      viewIo.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      let last = "intro";
      let idle: ReturnType<typeof setTimeout> | undefined;
      let gliding = false;
      let lastDir: 1 | -1 = 1;
      const st = ScrollTrigger.create({
        trigger: wrap.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          progress.current = self.progress;
          if (self.direction) lastDir = dir.current = self.direction as 1 | -1;
          // A real skier doesn't freeze mid-slope: when scrolling stops during a descent or a lift
          // ride, glide on to the next summit at a natural speed (any new scroll takes over).
          clearTimeout(idle);
          if (!gliding) {
            idle = setTimeout(() => {
              const g = glideFrom(st.progress, lastDir);
              const lenis = getLenis();
              if (!g || !lenis) return;
              gliding = true;
              const y = st.start + (st.end - st.start) * g.to;
              lenis.scrollTo(y, {
                duration: g.seconds,
                easing: (x: number) => (x < 0.12 ? (x / 0.12) ** 2 * 0.12 : x > 0.9 ? 1 - ((1 - x) / 0.1) ** 2 * 0.1 : x),
                onComplete: () => {
                  gliding = false;
                },
              });
              // Any input takes over right where the skier is. Without this, Lenis keeps the glide's
              // destination as its target and adds the wheel delta to it, so scrolling UP mid-glide
              // would still carry the run forward. Runs in the capture phase, before Lenis sees the event.
              const stop = () => {
                window.removeEventListener("wheel", stop, true);
                window.removeEventListener("touchstart", stop, true);
                window.removeEventListener("keydown", stop, true);
                if (!gliding) return;
                gliding = false;
                lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
              };
              window.addEventListener("wheel", stop, { passive: true, capture: true });
              window.addEventListener("touchstart", stop, { passive: true, capture: true });
              window.addEventListener("keydown", stop, { capture: true });
            }, 450);
          }
          const c = cardAt(self.progress, lastDir);
          const k = keyOf(c);
          if (k !== last) {
            last = k;
            setCard(c);
          }
        },
      });
      return () => clearTimeout(idle);
    },
    { scope: wrap, dependencies: [count] },
  );

  // Cross-fade: the current panel fades + blurs out, then the next one fades + sharpens in.
  // Scrolling back plays it in reverse: the old card drops away and the previous one comes down from above.
  useEffect(() => {
    if (keyOf(card) === keyOf(shown) || !panel.current) return;
    const tween = gsap.to(panel.current, {
      autoAlpha: 0,
      y: -14 * dir.current,
      filter: "blur(8px)",
      duration: 0.35,
      ease: "power2.in",
      overwrite: true,
      onComplete: () => setShown(card),
    });
    return () => {
      tween.kill();
    };
  }, [card, shown]);
  useEffect(() => {
    if (!panel.current) return;
    gsap.fromTo(
      panel.current,
      { autoAlpha: 0, y: 22 * dir.current, filter: "blur(10px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out", overwrite: true },
    );
  }, [shown]);

  const dots = (current: number) => (
    <div className="mb-4 flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all duration-500 ${i === current ? "w-6 bg-accent" : i < current ? "w-2 bg-accent/60" : "w-2 bg-fg/15"}`}
        />
      ))}
    </div>
  );

  // Frosted glass: translucent white, strong backdrop blur, a light rim and a soft top highlight
  const glass =
    "border border-white/60 bg-gradient-to-br from-white/55 via-white/35 to-white/20 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_18px_50px_-18px_rgba(17,19,24,0.35),inset_0_1px_0_rgba(255,255,255,0.8)]";

  return (
    <div ref={wrap} className="relative h-[950vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          {near && <SkiCanvas active={active} progress={progress} reduced={false} onSplat={onSplat} />}
        </div>
        {/* snow on the lens sits above the scene but below the card; keeps the card's side clear */}
        <SnowSplats ref={splats} avoid={0.42} />

        <div className="pointer-events-none relative mx-auto flex h-full max-w-6xl items-center px-8 pt-(--header-h)">
          <div
            ref={panel}
            aria-live="polite"
            className={
              shown.kind === "travel"
                ? `pointer-events-auto mt-[calc(var(--header-h)+1.5rem)] self-start rounded-full px-4 py-2 font-mono text-xs text-fg/70 ${glass}`
                : `pointer-events-auto w-full max-w-md rounded-3xl p-7 ${glass}`
            }
          >
            {shown.kind === "travel" && (
              <>
                <span className="text-accent-strong">&#x276F;</span> {(shown.back ? TRAVEL_BACK : TRAVEL)[shown.via]}{" "}
                <span className="text-fg">{entries[Math.min(shown.index, count - 1)]?.company}</span>
              </>
            )}

            {shown.kind === "intro" && (
              <>
                <p className="font-mono text-sm text-muted">
                  <span className="text-accent-strong">~/</span>experience
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  Experience<span className="text-accent-strong">.</span>
                </h2>
                <p className="mt-3 font-mono text-sm text-muted">
                  <span className="text-accent-strong">$</span> git log --reverse
                </p>
                <p className="mt-6 text-fg/80">
                  From civil engineering to shipping React products &mdash; scroll to ski it, summit to summit. Every
                  peak is a chapter, each one higher than the last.
                </p>
                <p className="mt-6 font-mono text-xs text-muted">scroll &darr;</p>
              </>
            )}

            {shown.kind === "entry" &&
              (() => {
                const e = entries[shown.index];
                return (
                  <>
                    {dots(shown.index)}
                    <p className="font-mono text-sm">
                      <span className="text-accent-strong">commit {e.hash}</span>
                      <span className="text-muted"> ({e.period})</span>
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold leading-tight">
                      {e.role} <span className="text-muted">@ {e.company}</span>
                    </h3>
                    {e.location && <p className="mt-1 font-mono text-xs text-muted">{e.location}</p>}
                    <ul className="mt-4 space-y-2 text-sm text-fg/85">
                      {e.points.map((pt) => (
                        <li key={pt} className="flex gap-3">
                          <span className="font-mono text-accent-strong">+</span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}

            {shown.kind === "end" && (
              <>
                {dots(count)}
                <p className="font-mono text-sm text-muted">
                  <span className="text-accent-strong">$</span> git checkout -b next
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                  Next checkpoint: <span className="text-accent-strong">your team?</span>
                </h3>
                <p className="mt-3 text-fg/80">The run doesn&apos;t end here. Let&apos;s find the next peak together.</p>
                <button
                  type="button"
                  onClick={() => scrollToSection("contact")}
                  className="mt-6 rounded-md bg-accent px-5 py-3 font-mono text-sm font-medium text-accent-ink"
                >
                  ./contact
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
