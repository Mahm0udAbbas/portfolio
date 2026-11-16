import Image from "next/image";
import type { CSSProperties } from "react";
import type { Project, Screen } from "@/content/site";

type Screens = NonNullable<Project["screens"]>;

/**
 * Live-site prototype: a browser window and a phone, each holding a full-page capture
 * of the real site. Hovering the card scrolls both pages from top to bottom ("hover"),
 * while the case-study view pans them on its own ("auto"). Static under reduced motion.
 */
export function ProjectShowcase({
  screens,
  url,
  mode,
  priority = false,
  className = "",
}: {
  screens: Screens;
  url?: string;
  mode: "hover" | "auto";
  priority?: boolean;
  className?: string;
}) {
  const host = url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
  return (
    <div data-showcase={mode} className={`showcase relative min-h-0 flex-col ${className}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(17_19_24/0.35)] md:mr-[12%]">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
          <span className="size-2 rounded-full bg-[#ff6b5f]" />
          <span className="size-2 rounded-full bg-[#ffbd2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
          {host && (
            <span className="mx-auto flex max-w-[60%] items-center gap-1.5 truncate rounded-md bg-bg px-3 py-0.5 font-mono text-[11px] text-muted">
              <span aria-hidden="true">🔒</span>
              {host}
            </span>
          )}
        </div>
        <Shot screen={screens.desktop} alt={`${screens.alt}: desktop page`} sizes="(min-width: 1024px) 720px, 60vw" priority={priority} />
      </div>
      <div className="showcase-phone absolute bottom-[-4%] right-0 hidden aspect-[9/19] w-[23%] min-w-[96px] max-w-[210px] flex-col rounded-[1.5rem] border-[5px] border-[#16181d] bg-[#16181d] shadow-[0_24px_50px_-18px_rgb(17_19_24/0.55)] md:flex">
        <span aria-hidden="true" className="absolute left-1/2 top-1.5 z-10 h-1.5 w-[34%] -translate-x-1/2 rounded-full bg-[#16181d]" />
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[1.1rem] bg-white">
          <Shot screen={screens.mobile} alt={`${screens.alt}: mobile page`} sizes="210px" priority={priority} delay />
        </div>
      </div>
    </div>
  );
}

function Shot({ screen, alt, sizes, priority, delay = false }: { screen: Screen; alt: string; sizes: string; priority: boolean; delay?: boolean }) {
  // Longer pages scroll for longer, so the reading pace stays about the same.
  const seconds = Math.min(16, Math.max(5, (screen.height / screen.width) * 2.4));
  return (
    <div className="showcase-screen relative min-h-0 flex-1 overflow-hidden bg-white [container-type:size]">
      <Image
        src={screen.src}
        alt={alt}
        width={screen.width}
        height={screen.height}
        sizes={sizes}
        priority={priority}
        className="showcase-shot absolute inset-x-0 top-0 h-auto w-full"
        style={{ "--pan": `${seconds}s`, "--pan-delay": delay ? "0.35s" : "0s" } as CSSProperties}
      />
    </div>
  );
}
