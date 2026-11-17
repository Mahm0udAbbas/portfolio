"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/content/site";
import { trackAsset } from "@/lib/asset-gate";
import { PRELOADER_DONE, isPreloading } from "@/lib/lenis";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { CARD_RADIUS, CARD_W, loadRingAssets, type RingAssets } from "./ring-assets";
import type { RingControl, ScreenBox } from "./projects-ring-canvas";
import { ProjectStack } from "./project-stack";

const RingCanvas = dynamic(() => import("./projects-ring-canvas"), { ssr: false });

const HERE = "/projects";

/**
 * The /projects page: a thick 3D "PROJECTS" word with the project cards standing in a ring around it.
 * The ring spins on its own, slows down under the pointer and can be dragged.
 * Clicking a card flies it out to face the viewer; a DOM copy of it then takes its place so the
 * project overlay can run its usual flip-open from that box (and flip back into it on close).
 * Reduced motion → the regular folder stack.
 */
export function ProjectsRing({ projects }: { projects: Project[] }) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const stage = useRef<HTMLDivElement>(null);
  const proxy = useRef<HTMLDivElement>(null);
  const proxyCard = useRef<HTMLDivElement>(null);
  const proxyImg = useRef<HTMLImageElement>(null);
  const control = useRef<RingControl | null>(null);
  const opened = useRef<string | null>(null);
  const [assets, setAssets] = useState<RingAssets | null>(null);
  const [inView, setInView] = useState(true);
  // Hold the intro until the preloader has handed the page over.
  const [intro, setIntro] = useState(() => typeof document !== "undefined" && !isPreloading());
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    trackAsset(loadRingAssets(projects)).then((a) => alive && setAssets(a), () => {});
    return () => {
      alive = false;
    };
  }, [reduced, projects]);

  useEffect(
    () => () => assets?.frontUrls.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u)),
    [assets],
  );

  useEffect(() => {
    if (intro) return;
    const go = () => setIntro(true);
    window.addEventListener(PRELOADER_DONE, go, { once: true });
    return () => window.removeEventListener(PRELOADER_DONE, go);
  }, [intro]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // The card is presented: show its DOM stand-in exactly over it and open the overlay route.
  const onPresented = useCallback(
    (i: number, box: ScreenBox) => {
      const el = proxy.current;
      const card = proxyCard.current;
      const img = proxyImg.current;
      if (!el || !card || !img || !assets) return;
      const p = projects[i];
      img.src = assets.frontUrls[i];
      card.dataset.projectCard = p.slug;
      card.style.borderRadius = `${(CARD_RADIUS / CARD_W) * box.width}px`;
      Object.assign(el.style, {
        display: "block",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      opened.current = p.slug;
      router.push(`/projects/${p.slug}`, { scroll: false });
    },
    [assets, projects, router],
  );

  // Back on /projects (overlay closed, or browser back): the card returns to the ring.
  useEffect(() => {
    if (pathname !== HERE || !opened.current) return;
    opened.current = null;
    const hide = () => {
      if (proxy.current) proxy.current.style.display = "none";
      if (proxyCard.current) delete proxyCard.current.dataset.projectCard;
    };
    if (control.current) control.current.release(hide);
    else hide();
  }, [pathname]);

  if (reduced) return <ProjectStack projects={projects} />;

  const overlayOpen = pathname !== HERE;

  return (
    <>
      <div
        ref={stage}
        data-clickable={hovered !== null ? "" : undefined}
        className="absolute inset-0 select-none"
        aria-hidden="true"
      >
        {assets && (
          <RingCanvas
            assets={assets}
            count={projects.length}
            running={inView && !overlayOpen}
            intro={intro}
            controlRef={control}
            onPresented={onPresented}
            onHover={setHovered}
          />
        )}
      </div>

      {/* What the pointer is on */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-10 text-center font-mono text-sm" aria-hidden="true">
        {hovered !== null ? (
          <>
            <span className="text-accent-strong">❯</span> {projects[hovered].title}{" "}
            <span className="text-muted">· {projects[hovered].tagline}</span>
          </>
        ) : (
          <span className="text-muted">drag to spin · click a card to open it</span>
        )}
      </p>

      {/* Keyboard / screen readers: real links. Focus turns the ring to that card; Enter opens it the same way. */}
      <ol className="sr-only">
        {projects.map((p, i) => (
          <li key={p.slug}>
            <Link
              href={`/projects/${p.slug}`}
              scroll={false}
              onFocus={() => control.current?.face(i)}
              onBlur={() => control.current?.face(null)}
              onClick={(e) => {
                if (!control.current) return; // not loaded yet: the overlay just fades in
                e.preventDefault();
                control.current.open(i);
              }}
            >
              {p.title} — {p.tagline}
            </Link>
          </li>
        ))}
      </ol>

      {/* DOM stand-in for the presented card (the overlay clones and flips it) */}
      {/* Outer box positions it; the inner card is what the overlay clones (it rewrites the clone's inline styles). */}
      <div ref={proxy} aria-hidden="true" className="pointer-events-none fixed z-20" style={{ display: "none" }}>
        <div ref={proxyCard} className="size-full overflow-hidden bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL of a canvas-drawn face */}
          <img ref={proxyImg} alt="" className="block size-full" draggable={false} />
        </div>
      </div>
    </>
  );
}
