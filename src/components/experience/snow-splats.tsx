"use client";

import { useCallback, useImperativeHandle, useState } from "react";

/**
 * Snow on the lens: powdery clumps that land where flakes hit the camera, blur the view a little
 * underneath (masked backdrop blur), then fade out. Driven by the ski-run scene via `splat()`.
 */
export type SnowSplatsHandle = { splat: (ndcX: number, ndcY: number, size: number) => void };

type Splat = { id: number; x: number; y: number; size: number; rot: number; tex: number };

const TEXTURES = 4;
let texCache: string[] | null = null;
let nextId = 0;

/** A few clumps of overlapping soft flakes, drawn once to canvas → data URLs (no downloads). */
function clumpTextures() {
  if (texCache) return texCache;
  texCache = Array.from({ length: TEXTURES }, (_, k) => {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d")!;
    let seed = 7 + k * 31;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const blobs = 26 + k * 6;
    for (let i = 0; i < blobs; i++) {
      // denser in the middle, scattered flecks around the edge
      const a = rnd() * Math.PI * 2;
      const d = Math.pow(rnd(), 1.7) * 62;
      const x = 80 + Math.cos(a) * d;
      const y = 80 + Math.sin(a) * d * 0.85;
      const r = (1 - d / 70) * 16 * (0.4 + rnd()) + 2;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,255,255,${0.75 + rnd() * 0.25})`);
      grad.addColorStop(0.55, "rgba(250,252,255,0.55)");
      grad.addColorStop(1, "rgba(245,248,255,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return c.toDataURL("image/png");
  });
  return texCache;
}

export function SnowSplats({
  ref,
  avoid,
}: {
  ref: React.Ref<SnowSplatsHandle>;
  /** Fraction of the screen width on the left to keep clear (the card lives there). */
  avoid: number;
}) {
  const [splats, setSplats] = useState<Splat[]>([]);
  const [textures] = useState(clumpTextures); // client-only component, so canvas is available

  const splat = useCallback(
    (ndcX: number, ndcY: number, size: number) => {
      let x = (ndcX + 1) / 2; // 0..1 across the screen
      const y = (1 - ndcY) / 2;
      if (x < avoid) x = avoid + 0.05 + Math.random() * (0.9 - avoid); // keep the card readable
      const s: Splat = {
        id: ++nextId,
        x: Math.min(Math.max(x, 0.02), 0.98),
        y: Math.min(Math.max(y, 0.04), 0.96),
        size,
        rot: Math.random() * 360,
        tex: Math.floor(Math.random() * TEXTURES),
      };
      setSplats((list) => [...list.slice(-11), s]);
      window.setTimeout(() => setSplats((list) => list.filter((q) => q.id !== s.id)), 1900);
    },
    [avoid],
  );

  useImperativeHandle(ref, () => ({ splat }), [splat]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {splats.map((s) => (
          <div
            key={s.id}
            className="snow-splat absolute"
            style={
              {
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                width: s.size,
                height: s.size,
                "--rot": `${s.rot}deg`,
                backgroundImage: `url(${textures[s.tex]})`,
                WebkitMaskImage: `url(${textures[s.tex]})`,
                maskImage: `url(${textures[s.tex]})`,
              } as React.CSSProperties
            }
          />
        ))}
    </div>
  );
}
