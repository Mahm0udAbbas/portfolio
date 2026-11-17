"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REVEAL_ID = "scroll-reveal";
const started = new WeakSet<Element>();

/**
 * Declarative scroll motion for server-rendered sections:
 * - `data-reveal`            fade/slide in when it enters (add `data-reveal-children` to stagger its children)
 * - `data-count="42"`        count up from 0 when it enters
 * - `data-timeline`          container whose `[data-timeline-line]` draws with scroll and lights `[data-timeline-dot]`s
 * Without JS / with reduced motion, everything simply renders in its final state.
 *
 * Each element is set up once and never reverted by React. Next's dev renderer can clean
 * this component's effects up after hydration without running them again; reverting
 * on that cleanup left every counter frozen at 0 and switched the reveals off.
 */
function setUp() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Elements from a page that has since been navigated away from.
  for (const t of ScrollTrigger.getAll()) {
    const el = t.trigger;
    if (t.vars.id === REVEAL_ID && el && !el.isConnected) t.kill(true);
  }
  const fresh = (el: Element) =>
    started.has(el) ? false : (started.add(el), true);
  const trigger = (el: Element, start: string) => ({
    id: REVEAL_ID,
    trigger: el,
    start,
    toggleActions: "play none none reverse",
  });

  gsap.utils
    .toArray<HTMLElement>("[data-reveal]")
    .filter(fresh)
    .forEach((el) => {
      const targets = el.hasAttribute("data-reveal-children")
        ? Array.from(el.children)
        : el;
      gsap.from(targets, {
        autoAlpha: 0,
        y: 36,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        // play on the way down, rewind when scrolled back above the trigger
        scrollTrigger: trigger(el, "top 85%"),
      });
    });

  gsap.utils
    .toArray<HTMLElement>("[data-count]")
    .filter(fresh)
    .forEach((el) => {
      const end = Number(el.dataset.count) || 0;
      const o = { v: 0 };
      el.textContent = "0";
      gsap.to(o, {
        v: end,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: trigger(el, "top 90%"),
        onUpdate: () => {
          el.textContent = String(Math.round(o.v));
        },
      });
    });

  gsap.utils
    .toArray<HTMLElement>("[data-timeline]")
    .filter(fresh)
    .forEach((tl) => {
      const fill = tl.querySelector("[data-timeline-line]");
      gsap.fromTo(
        fill,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          transformOrigin: "50% 0%",
          scrollTrigger: {
            id: REVEAL_ID,
            trigger: tl,
            start: "top 65%",
            end: "bottom 65%",
            scrub: 0.6,
          },
        },
      );
      tl.querySelectorAll<HTMLElement>("[data-timeline-dot]").forEach((dot) => {
        gsap.set(dot, { scale: 0.5, backgroundColor: "var(--line)" });
        ScrollTrigger.create({
          id: REVEAL_ID,
          trigger: dot,
          start: "top 65%",
          onEnter: () =>
            gsap.to(dot, {
              scale: 1,
              backgroundColor: "var(--accent)",
              duration: 0.5,
              ease: "back.out(3)",
            }),
          onLeaveBack: () =>
            gsap.to(dot, {
              scale: 0.5,
              backgroundColor: "var(--line)",
              duration: 0.3,
            }),
        });
      });
    });
  ScrollTrigger.refresh();
}

export function ScrollReveals() {
  useEffect(() => {
    setUp();
  }, []);
  return null;
}
