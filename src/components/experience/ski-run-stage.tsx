"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Experience } from "@/content/site";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { scrollToSection } from "@/lib/lenis";
import { CHECKPOINTS, cardAt, type Card } from "./ski-timeline";

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

const keyOf = (c: Card) => (c.kind === "entry" ? `e${c.index}` : c.kind === "travel" ? `t${c.via}${c.index}` : c.kind);
const TRAVEL = { descent: "skiing down from", lift: "chairlift up to", summit: "at the summit of" } as const;

function SkiRun({ entries }: { entries: Experience[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [card, setCard] = useState<Card>({ kind: "intro" });
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
      ScrollTrigger.create({
        trigger: wrap.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          progress.current = self.progress;
          const c = cardAt(self.progress);
          const k = keyOf(c);
          if (k !== last) {
            last = k;
            setCard(c);
          }
        },
      });
    },
    { scope: wrap, dependencies: [count] },
  );

  const dots = (current: number) => (
    <div className="mb-4 flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all duration-500 ${i === current ? "w-6 bg-accent" : i < current ? "w-2 bg-accent/60" : "w-2 bg-line"}`}
        />
      ))}
    </div>
  );

  return (
    <div ref={wrap} className="relative h-[500vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          {near && <SkiCanvas active={active} progress={progress} reduced={false} />}
        </div>

        <div className="pointer-events-none relative mx-auto flex h-full max-w-6xl items-center px-8 pt-(--header-h)">
          {card.kind === "travel" ? (
            <div className="ski-card pointer-events-auto self-start mt-[calc(var(--header-h)+1.5rem)] rounded-full border border-line bg-surface/80 px-4 py-2 font-mono text-xs text-muted backdrop-blur-md">
              <span className="text-accent-strong">❯</span> {TRAVEL[card.via]}{" "}
              <span className="text-fg">{entries[Math.min(card.index, count - 1)]?.company}</span>
            </div>
          ) : (
          <div
            key={keyOf(card)}
            className="ski-card pointer-events-auto w-full max-w-md rounded-2xl border border-line bg-surface/80 p-7 shadow-[0_30px_70px_-30px_rgba(17,19,24,0.35)] backdrop-blur-md"
          >
            {card.kind === "intro" && (
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
                <p className="mt-6 text-fg/75">
                  From civil engineering to shipping React products — scroll to ski it, summit to summit. Every
                  peak is a chapter, each one higher than the last.
                </p>
                <p className="mt-6 font-mono text-xs text-muted">scroll ↓</p>
              </>
            )}

            {card.kind === "entry" &&
              (() => {
                const e = entries[card.index];
                return (
                  <>
                    {dots(card.index)}
                    <p className="font-mono text-sm">
                      <span className="text-accent-strong">commit {e.hash}</span>
                      <span className="text-muted"> ({e.period})</span>
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold leading-tight">
                      {e.role} <span className="text-muted">@ {e.company}</span>
                    </h3>
                    {e.location && <p className="mt-1 font-mono text-xs text-muted">{e.location}</p>}
                    <ul className="mt-4 space-y-2 text-sm text-fg/80">
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

            {card.kind === "end" && (
              <>
                {dots(count)}
                <p className="font-mono text-sm text-muted">
                  <span className="text-accent-strong">$</span> git checkout -b next
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                  Next checkpoint: <span className="text-accent-strong">your team?</span>
                </h3>
                <p className="mt-3 text-fg/75">The run doesn&apos;t end here. Let&apos;s find the next peak together.</p>
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
          )}
        </div>
      </div>
    </div>
  );
}
