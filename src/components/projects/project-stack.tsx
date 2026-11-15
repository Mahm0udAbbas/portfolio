"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Project } from "@/content/site";
import { ProjectMedia } from "./project-media";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Full-width project cards that stick and stack like folders:
 * each card sticks a tab-height lower than the previous, so earlier folders' tabs stay visible.
 * Hover = pop up + tilt + play preview. Click = open the overlay (/projects/[slug]).
 */
export function ProjectStack({ projects }: { projects: Project[] }) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-stack-item]");
        items.forEach((item, i) => {
          const next = items[i + 1];
          if (!next) return;
          // As the next folder slides over, this one recedes and darkens.
          const tl = gsap.timeline({
            scrollTrigger: { trigger: next, start: "top bottom", end: "top 30%", scrub: true },
          });
          tl.to(item.querySelector("[data-stack-layer]"), { scale: 0.94, transformOrigin: "50% 0%", ease: "none" }, 0).to(
            item.querySelectorAll("[data-stack-shade]"),
            { opacity: 0.22, ease: "none" },
            0,
          );
        });
      });
    },
    { scope: root },
  );

  return (
    <ol ref={root} className="flex flex-col gap-[22vh] pb-[12vh] [--tab:2.75rem] md:[--tab:3.25rem]">
      {projects.map((p, i) => (
        <li
          key={p.slug}
          data-stack-item
          className="sticky"
          style={{ top: `calc(var(--header-h) + 1rem + ${i} * var(--tab))` }}
        >
          <div data-stack-layer className="will-change-transform">
            <ProjectCard project={p} index={i} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProjectCard({ project: p, index: i }: { project: Project; index: number }) {
  const card = useRef<HTMLAnchorElement>(null);
  const tabOffset = `${(i % 4) * 18}%`;
  const canHover = () => window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches;

  const onEnter = () => {
    card.current?.querySelector<HTMLVideoElement>("video[data-preview]")?.play().catch(() => {});
  };
  const onMove = (e: React.PointerEvent) => {
    if (!card.current || !canHover()) return;
    const r = card.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(card.current, {
      y: -16,
      rotateY: px * 5,
      rotateX: -py * 5,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto",
    });
  };
  const onLeave = () => {
    card.current?.querySelector<HTMLVideoElement>("video[data-preview]")?.pause();
    if (!card.current) return;
    gsap.to(card.current, { y: 0, rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1, 0.55)", overwrite: "auto" });
  };

  return (
    <div className="[perspective:1400px]">
      <Link
        ref={card}
        href={`/projects/${p.slug}`}
        scroll={false}
        data-project-card={p.slug}
        onClick={(e) => {
          // Drop the hover pop/tilt so the overlay flips from the card's resting position.
          gsap.killTweensOf(e.currentTarget);
          gsap.set(e.currentTarget, { y: 0, rotateX: 0, rotateY: 0 });
          e.currentTarget.querySelector<HTMLVideoElement>("video[data-preview]")?.pause();
        }}
        onPointerEnter={onEnter}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="group relative flex flex-col outline-none [transform-style:preserve-3d]"
      >
        {/* Folder tab */}
        <div className="flex">
          <div
            className="relative z-10 -mb-px flex h-(--tab) items-center gap-3 rounded-t-xl border border-b-0 border-line bg-surface px-5 font-mono text-sm transition-colors group-hover:border-accent/60 group-focus-visible:border-accent"
            style={{ marginLeft: tabOffset }}
          >
            <span className="text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
            <span className="truncate text-fg">{p.title}</span>
            <span data-stack-shade aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[#111318] opacity-0" />
          </div>
        </div>

        {/* Folder body */}
        <article
          className={`relative grid h-[min(68svh,620px)] gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] duration-300 group-hover:border-accent/60 group-hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent),0_30px_80px_-30px_color-mix(in_srgb,var(--accent)_35%,transparent)] group-focus-visible:border-accent sm:p-8 md:grid-cols-[1fr_1.15fr] md:gap-10 md:p-10 ${
            i % 4 === 0 ? "rounded-tl-none" : ""
          }`}
        >
          <div className="flex min-h-0 flex-col justify-between">
            <p className="font-mono text-xs text-muted sm:text-sm">
              {p.year} · {p.role}
            </p>
            <div>
              <h3 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{p.title}</h3>
              <p className="mt-3 max-w-md text-base text-fg/70 sm:text-lg">{p.tagline}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {p.stack.map((s) => (
                  <li key={s} className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <p className="font-mono text-sm text-muted transition-colors group-hover:text-accent-strong">
              open project <span className="inline-block transition-transform group-hover:translate-x-1">↗</span>
            </p>
          </div>

          <ProjectMedia project={p} index={i} className="hidden min-h-0 md:flex" />

          <div data-stack-shade aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#111318] opacity-0" />
        </article>
      </Link>
    </div>
  );
}
