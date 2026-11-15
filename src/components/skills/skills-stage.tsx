"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { SkillGroup } from "@/content/site";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { CAP_COLORS, type SkillKey } from "./keycap-colors";

// Physics (Rapier wasm) + WebGL only load when the section gets close.
const KeycapPile = dynamic(() => import("./keycap-pile"), { ssr: false });

/**
 * Skills as a pile of 3D keycaps that drop in when the section is reached.
 * Drag & throw them, click to make one hop, or type a letter to bounce every skill starting with it.
 * Reduced motion → the plain keycap grid.
 */
export function SkillsStage({ groups }: { groups: SkillGroup[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [near, setNear] = useState(false);
  const [running, setRunning] = useState(false);
  const [hovered, setHovered] = useState<SkillKey | null>(null);

  const skills: SkillKey[] = groups.flatMap((g, gi) => g.items.map((name) => ({ name, group: gi, groupLabel: g.label })));

  useEffect(() => {
    const el = stage.current;
    if (!el || reduced) return;
    const nearIo = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "800px 0px" });
    const viewIo = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), { threshold: 0.35 });
    nearIo.observe(el);
    viewIo.observe(el);
    return () => {
      nearIo.disconnect();
      viewIo.disconnect();
    };
  }, [reduced]);

  if (reduced) return <KeycapGrid groups={groups} />;

  return (
    <div>
      <div ref={stage} className="relative h-[min(72vh,640px)] w-full touch-pan-y select-none">
        {near && <KeycapPile skills={skills} running={running} onHover={setHovered} />}

        <p className="pointer-events-none absolute bottom-3 left-0 font-mono text-sm" aria-live="polite">
          {hovered ? (
            <>
              <span className="text-accent">❯</span> {hovered.name} <span className="text-muted">· {hovered.groupLabel}</span>
            </>
          ) : (
            <span className="text-muted">drag · throw · click · or just type a letter</span>
          )}
        </p>
      </div>

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted">
        {groups.map((g, i) => (
          <li key={g.label} className="flex items-center gap-2">
            <span className="size-3 rounded-sm border border-line" style={{ background: CAP_COLORS[i % CAP_COLORS.length].body }} />
            {g.label}
          </li>
        ))}
      </ul>

      {/* Full list for screen readers / search engines */}
      <ul className="sr-only">
        {groups.map((g) => (
          <li key={g.label}>
            {g.label}: {g.items.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeycapGrid({ groups }: { groups: SkillGroup[] }) {
  return (
    <div className="grid gap-10 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-4 font-mono text-sm text-muted">{g.label}</h3>
          <ul className="flex flex-wrap gap-3">
            {g.items.map((s) => (
              <li key={s} className="rounded-lg border border-b-4 border-line bg-surface-2 px-4 py-2 font-mono text-sm">
                {s}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
