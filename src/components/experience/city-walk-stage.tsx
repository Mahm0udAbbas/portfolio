"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { Experience } from "@/content/site";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { getLenis, lockScroll, scrollToSection } from "@/lib/lenis";
import { chapterProgress, crossedCheckpoint, WALK_END, type WalkChapter } from "./walk-timeline";

gsap.registerPlugin(ScrollTrigger, useGSAP);
const CityCanvas = dynamic(() => import("./city-walk-canvas"), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { requestAnimationFrame(() => ScrollTrigger.refresh()); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function CityWalkStage({ entries, fallback }: { entries: Experience[]; fallback: ReactNode }) {
  const reduced = useReducedMotion();
  const small = useMediaQuery("(max-width: 1023px)");
  const [simple, setSimple] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => ScrollTrigger.refresh()); return () => cancelAnimationFrame(id); }, [small, reduced, simple]);
  if (small !== false || reduced || !entries.length) return <>{fallback}</>;
  if (simple) return <>
    <div className="mx-auto flex max-w-[1440px] justify-end px-6 pt-6 lg:px-10">
      <button type="button" onClick={() => setSimple(false)}
        className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 font-mono text-xs text-fg transition hover:border-accent">
        Walk the street instead ↗
      </button>
    </div>
    {fallback}
  </>;
  return <SceneBoundary fallback={fallback}><Journey entries={entries} onSimple={() => setSimple(true)} /></SceneBoundary>;
}

function Journey({ entries, onSimple }: { entries: Experience[]; onSimple: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const seek = useRef<number | null>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const held = useRef<number | null>(null);
  const releaseLock = useRef<(() => void) | null>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  // Once the walk reaches its end the section collapses to one screen (the end scene),
  // so the page scrolls on to the next sections normally in both directions.
  const done = useRef(false);
  const collapse = useRef<{ height: number; inside: boolean } | null>(null);
  const reopenAt = useRef<number | "start" | null>(null);
  const leaveAfter = useRef(false);
  const cut = useRef(false);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState<number | null>(null);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState<WalkChapter>({ kind: "intro", index: 0 });
  const onReady = useCallback(() => setReady(true), []);
  const onChapter = useCallback((c: WalkChapter) => setChapter(c), []);
  const entry = entries[chapter.index];
  const resume = () => {
    held.current = null;
    releaseLock.current?.();
    releaseLock.current = null;
    setPaused(null);
  };
  const holdAt = useCallback((index: number, self: ScrollTrigger) => {
    const destination = chapterProgress(index, entries.length);
    held.current = destination;
    progress.current = destination;
    // The canvas reports the chapter once the walker actually arrives.
    setPaused(index);
    const top = self.start + (self.end - self.start) * destination;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo({ top, behavior: "instant" });
    releaseLock.current ??= lockScroll();
  }, [entries.length]);

  const finish = useCallback((self: ScrollTrigger, pause = true) => {
    if (done.current) return;
    done.current = true;
    held.current = null;
    progress.current = 1;
    collapse.current = { height: wrap.current!.offsetHeight, inside: window.scrollY < self.end - 1 };
    if (pause && collapse.current.inside) {
      // A short pause on the end scene, so wheel momentum can't fling past it.
      const release = lockScroll();
      window.setTimeout(release, 900);
    }
    setFinished(true);
  }, []);
  // Keep the view steady while the section's height changes.
  useLayoutEffect(() => {
    const el = wrap.current;
    const lenis = getLenis();
    const to = (top: number) => {
      if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo({ top, behavior: "instant" });
    };
    if (finished && collapse.current) {
      const { height, inside } = collapse.current;
      collapse.current = null;
      if (el && inside) to(el.getBoundingClientRect().top + window.scrollY);
      else if (el && el.getBoundingClientRect().top < 0) to(window.scrollY - (height - el.offsetHeight));
      ScrollTrigger.refresh();
      if (leaveAfter.current) { leaveAfter.current = false; leave(); }
    }
    if (!finished && reopenAt.current !== null) {
      const index = reopenAt.current;
      reopenAt.current = null;
      ScrollTrigger.refresh();
      const t = trigger.current;
      if (t && index === "start") {
        // Back to the first step: cut the walker to the start and scroll to the street's top.
        progress.current = 0;
        cut.current = true;
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(t.start, { immediate: true, force: true });
        else window.scrollTo({ top: t.start, behavior: "instant" });
      } else if (t && index !== "start") holdAt(index, t);
    }
  }, [finished, holdAt]);

  useEffect(() => () => { releaseLock.current?.(); releaseLock.current = null; }, []);
  /** Smooth-scroll on to whatever section follows the walk. */
  function leave() {
    const next = wrap.current?.closest("section")?.nextElementSibling as HTMLElement | null;
    if (!next) return;
    requestAnimationFrame(() => {
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(next);
      else next.scrollIntoView({ behavior: "smooth" });
    });
  }
  /** From the end scene, reopen the street and start the walk again. */
  const restart = () => {
    if (!done.current) return;
    seek.current = null;
    done.current = false;
    reopenAt.current = "start";
    setFinished(false);
  };
  /** Skip the walk: cut to the end scene and carry on to the next section. */
  const skip = () => {
    const t = trigger.current;
    if (!t) return;
    resume();
    seek.current = null;
    cut.current = true;
    if (done.current) return leave();
    leaveAfter.current = true;
    finish(t, false);
  };
  useEffect(() => {
    if (paused !== null && chapter.kind === "entry") continueButton.current?.focus({ preventScroll: true });
  }, [paused, chapter.kind]);

  useEffect(() => {
    const el = wrap.current!;
    const prefetch = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: "1000px" });
    const visible = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    prefetch.observe(el); visible.observe(el);
    return () => { prefetch.disconnect(); visible.disconnect(); };
  }, []);
  useGSAP(() => {
    trigger.current = ScrollTrigger.create({ trigger: wrap.current, start: "top top", end: "bottom bottom",
      onUpdate: (self) => {
        if (done.current || held.current !== null) return;
        if (self.progress >= WALK_END) return finish(self);
        const crossed = crossedCheckpoint(progress.current, self.progress, entries.length);
        if (crossed !== null) holdAt(crossed, self);
        else progress.current = self.progress;
      },
      onRefresh: (self) => {
        if (done.current || held.current !== null) return;
        if (self.progress >= WALK_END) finish(self);
        else progress.current = self.progress;
      },
    });
    ScrollTrigger.refresh();
    return () => { trigger.current = null; };
  }, { scope: wrap });
  // Bypass Lenis inertia only while walking through this section. One input = one move.
  useEffect(() => {
    let touchY = 0;
    const jump = (top: number) => {
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(top, { immediate: true });
      else window.scrollTo({ top, behavior: "instant" });
      ScrollTrigger.update();
    };
    // The walk only goes forward, whichever way the wheel turns; chips revisit earlier
    // stops. Scrolling up at the very top of the section leaves upward, and reaching
    // the end collapses the section so scrolling continues to the next sections.
    const atTop = (t: ScrollTrigger) => window.scrollY <= t.start + 2;
    const move = (delta: number, event: Event) => {
      const t = trigger.current;
      if (!t?.isActive || done.current) return;
      if (delta < 0 && held.current === null && atTop(t)) return;
      event.preventDefault();
      event.stopPropagation();
      if (held.current !== null) return;
      jump(window.scrollY + Math.abs(delta));
    };
    const key = (e: KeyboardEvent) => {
      const t = trigger.current;
      if (!t?.isActive || done.current || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      const back = e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
      if (!back || (held.current === null && atTop(t))) return;
      e.preventDefault();
      if (held.current !== null) return;
      jump(window.scrollY + (e.key === "ArrowUp" ? 80 : window.innerHeight * 0.6));
    };
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      move(pixels * 1.8, e);
    };
    const start = (e: TouchEvent) => { if (e.touches.length === 1) touchY = e.touches[0].clientY; };
    const touch = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      move((touchY - y) * 1.9, e); touchY = y;
    };
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", touch, { capture: true, passive: false });
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", touch, true);
    };
  }, []);
  // Chapter chips walk the character to that stop (forward or back) and hold there.
  const go = (index: number) => {
    const t = trigger.current;
    if (!t || paused === index) return;
    seek.current = chapterProgress(index, entries.length);
    if (done.current) {
      // Reopen the street, then walk back from the end to this stop.
      done.current = false;
      reopenAt.current = index;
      setFinished(false);
      return;
    }
    holdAt(index, t);
  };
  const walkingTo = paused !== null && chapter.kind === "travel" ? entries[paused] : null;

  return <div ref={wrap} style={{ height: finished ? "100dvh" : `${220 + entries.length * 380}vh` }} className="relative bg-[#263e65] text-[#fff5e7]">
    <div className="sticky top-0 h-dvh overflow-hidden">
      <div className="absolute inset-0" aria-hidden="true">
        {near && <CityCanvas active={active} progress={progress} seek={seek} cut={cut} count={entries.length} onChapter={onChapter} onReady={onReady} />}
      </div>
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${chapter.kind === "entry" ? "opacity-0" : "opacity-100"} bg-gradient-to-r from-[#101c30]/85 via-[#101c30]/20 to-transparent`} />
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${chapter.kind === "entry" ? "opacity-100" : "opacity-0"} bg-gradient-to-l from-[#101c30]/85 via-[#101c30]/20 to-transparent`} />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#152238]/70 to-transparent" />
      <div className="city-interface relative mx-auto flex h-full max-w-[1440px] flex-col px-10 pb-8 pt-[calc(var(--header-h)+2rem)]">
        <div className="city-heading flex items-start justify-between">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#e6bf94]">A walk through my career</p>
            <h2 className="mt-2 text-3xl font-medium tracking-tight">Experience<span className="text-[#ffb779]">.</span></h2></div>
          <div className="flex gap-2">
            {!finished && <button type="button" onClick={skip} className="cursor-pointer rounded-full border border-white/25 bg-[#152238]/50 px-4 py-2 font-mono text-xs text-white/80 transition hover:bg-white/15">Skip walk ↓</button>}
            <button type="button" onClick={onSimple} className="cursor-pointer rounded-full border border-white/25 bg-[#152238]/50 px-4 py-2 font-mono text-xs text-white/80 transition hover:bg-white/15">Read timeline ↗</button>
          </div>
        </div>
        <div className={`flex flex-1 items-center ${chapter.kind === "entry" ? "city-inspection justify-end" : "justify-start"}`}>
          <div key={`${chapter.kind}-${chapter.index}`} className="city-chapter w-[min(40vw,510px)] rounded-2xl border border-white/15 bg-[#111e31]/70 p-6 shadow-2xl backdrop-blur-xl">
            {chapter.kind === "intro" && <>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#e6bf94]">Every step builds on the last</p>
              <h3 className="mt-5 text-4xl font-medium leading-[1.12] tracking-tight">Different streets.<br />One direction.</h3>
              <p className="mt-5 text-sm leading-7 text-white/75">From civil engineering to building digital experiences. Walk through the chapters that brought me here.</p>
              <p className="mt-7 font-mono text-xs text-[#ffbd86]">{ready ? "Scroll either way to take the first step" : "Opening the street…"}</p>
            </>}
            {walkingTo && <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e6bf94]">Walking to chapter {String(paused! + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-2xl font-medium">{walkingTo.company}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">{walkingTo.period}</p>
            </>}
            {chapter.kind === "travel" && !walkingTo && finished && <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e6bf94]">Last stretch</p>
              <h3 className="mt-3 text-2xl font-medium">Walking to the road ahead.</h3>
            </>}
            {chapter.kind === "travel" && !walkingTo && !finished && <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e6bf94]">Along the way</p>
              <h3 className="mt-3 text-2xl font-medium">One step closer to the next chapter.</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">Keep scrolling to walk. Pause to take in the street.</p>
            </>}
            {chapter.kind === "entry" && <>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#e6bf94]">Chapter {String(chapter.index + 1).padStart(2, "0")} / {entry.period}</p>
              <h3 className="mt-4 text-[clamp(1.25rem,2vw,1.8rem)] font-medium leading-tight">{entry.role}</h3>
              <p className="mt-2 text-base text-[#ffbd86]">{entry.company}</p>
              {entry.location && <p className="mt-1 font-mono text-[11px] text-white/50">{entry.location}</p>}
              <ul className="mt-5 space-y-3 text-[13px] leading-[1.65] text-white/80">{entry.points.map(pt => <li key={pt} className="flex gap-3"><span className="text-[#ffbd86]">—</span><span>{pt}</span></li>)}</ul>
              {paused !== null && <button ref={continueButton} type="button" onClick={resume}
                className="mt-4 cursor-pointer rounded-full bg-[#ffc18e] px-5 py-2.5 text-sm font-medium text-[#172135] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Continue walking →
              </button>}
            </>}
            {chapter.kind === "end" && <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e6bf94]">The road ahead</p>
              <h3 className="mt-4 text-4xl font-medium tracking-tight">Next stop:<br />your team?</h3>
              <p className="mt-4 text-sm leading-7 text-white/75">Let&apos;s build something worth taking the next step for.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => scrollToSection("contact")} className="cursor-pointer rounded-full bg-[#ffc18e] px-6 py-3 text-sm font-medium text-[#24212b]">Let&apos;s talk ↗</button>
                {finished && <button type="button" onClick={restart} className="cursor-pointer rounded-full border border-white/25 px-5 py-3 text-sm text-white/85 transition hover:bg-white/10">↺ Start from the beginning</button>}
              </div>
            </>}
          </div>
        </div>
        <nav aria-label="Career chapters" className="flex items-center gap-3">
          {entries.map((e, i) => <button type="button" key={e.hash} onClick={() => go(i)} aria-current={paused === i || (chapter.kind === "entry" && chapter.index === i) ? "step" : undefined}
            className={`cursor-pointer rounded-full border px-4 py-2.5 text-xs transition ${paused === i || (chapter.kind === "entry" && chapter.index === i) ? "border-[#ffc18e] bg-[#ffc18e] text-[#172135]" : "border-white/20 bg-[#142139]/70 text-white/75 hover:border-white/60"}`}>
            <span className="mr-2 font-mono opacity-60">0{i + 1}</span>{e.company}
          </button>)}
          <span className="ml-auto font-mono text-[10px] text-white/50">SCROLL UP OR DOWN TO WALK · PICK A CHAPTER TO REVISIT</span>
        </nav>
      </div>
    </div>
  </div>;
}
