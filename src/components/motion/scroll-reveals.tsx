"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Declarative scroll motion for server-rendered sections:
 * - `data-reveal`            fade/slide in when it enters (add `data-reveal-children` to stagger its children)
 * - `data-count="42"`        count up from 0 when it enters
 * - `data-timeline`          container whose `[data-timeline-line]` draws with scroll and lights `[data-timeline-dot]`s
 * Without JS / with reduced motion, everything simply renders in its final state.
 */
export function ScrollReveals() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        const targets = el.hasAttribute("data-reveal-children") ? Array.from(el.children) : el;
        gsap.from(targets, {
          autoAlpha: 0,
          y: 36,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
          // play on the way down, rewind when scrolled back above the trigger
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
        const end = Number(el.dataset.count) || 0;
        const o = { v: 0 };
        el.textContent = "0";
        gsap.to(o, {
          v: end,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
          onUpdate: () => {
            el.textContent = String(Math.round(o.v));
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-timeline]").forEach((tl) => {
        const fill = tl.querySelector("[data-timeline-line]");
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            transformOrigin: "50% 0%",
            scrollTrigger: { trigger: tl, start: "top 65%", end: "bottom 65%", scrub: 0.6 },
          },
        );
        tl.querySelectorAll<HTMLElement>("[data-timeline-dot]").forEach((dot) => {
          gsap.set(dot, { scale: 0.5, backgroundColor: "var(--line)" });
          ScrollTrigger.create({
            trigger: dot,
            start: "top 65%",
            onEnter: () =>
              gsap.to(dot, { scale: 1, backgroundColor: "var(--accent)", duration: 0.5, ease: "back.out(3)" }),
            onLeaveBack: () => gsap.to(dot, { scale: 0.5, backgroundColor: "var(--line)", duration: 0.3 }),
          });
        });
      });
    });
  });

  return null;
}
