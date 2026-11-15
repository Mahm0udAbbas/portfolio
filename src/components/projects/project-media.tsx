import Image from "next/image";
import type { Project } from "@/content/site";
import { PROJECT_TINTS } from "@/lib/project-tints";

/**
 * Project preview inside a mock browser frame.
 * Real media comes from `project.media`; without it, a generated placeholder is shown.
 * Videos carry `data-preview` so the card can play them on hover.
 */
export function ProjectMedia({
  project,
  index,
  sizes = "(min-width: 768px) 45vw, 100vw",
  className = "",
}: {
  project: Project;
  index: number;
  sizes?: string;
  className?: string;
}) {
  const tint = PROJECT_TINTS[index % PROJECT_TINTS.length];
  const m = project.media;

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-line bg-bg ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted">{project.slug}.dev</span>
      </div>

      <div className="relative min-h-0 flex-1">
        {m?.type === "video" ? (
          <video
            data-preview
            src={m.src}
            aria-label={m.alt}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
        ) : m?.type === "image" ? (
          <Image src={m.src} alt={m.alt} fill sizes={sizes} className="object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center"
            style={{
              backgroundImage: `radial-gradient(120% 90% at 20% 10%, color-mix(in srgb, ${tint} 28%, transparent), transparent 60%),
                linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)`,
              backgroundSize: "100% 100%, 32px 32px, 32px 32px",
            }}
          >
            <span className="font-mono text-2xl font-medium tracking-tight sm:text-3xl" style={{ color: tint }}>
              {"<"}
              {project.title.replace(/\s+/g, "")}
              {" />"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
