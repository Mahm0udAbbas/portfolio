import type { Project } from "@/content/site";
import { ProjectMedia } from "./project-media";

/** Case-study content — shared by the overlay (intercepted route) and the full /projects/[slug] page. */
export function ProjectDetail({ project: p, index }: { project: Project; index: number }) {
  const links = [
    p.links.live && { label: "live site", href: p.links.live },
    p.links.repo && { label: "source code", href: p.links.repo },
  ].filter((l): l is { label: string; href: string } => !!l);

  return (
    <article className="mx-auto w-full max-w-5xl px-4 pb-24 pt-20 sm:px-8 md:pt-24">
      <p className="font-mono text-sm text-muted">
        <span className="text-accent">~/</span>projects/{p.slug}
      </p>
      <h1 id="project-title" className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">
        {p.title}
      </h1>
      <p className="mt-4 max-w-2xl text-xl text-fg/75">{p.tagline}</p>

      <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-line py-6 font-mono text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">year</dt>
          <dd className="mt-1">{p.year}</dd>
        </div>
        <div>
          <dt className="text-muted">role</dt>
          <dd className="mt-1">{p.role}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-muted">stack</dt>
          <dd className="mt-1">{p.stack.join(" · ")}</dd>
        </div>
      </dl>

      <ProjectMedia project={p} index={index} sizes="(min-width: 1024px) 960px, 100vw" className="mt-10 aspect-video" />

      <div className="mt-12 grid gap-10 md:grid-cols-[2fr_1fr]">
        <p className="text-lg leading-relaxed text-fg/85">{p.description}</p>
        <div className="font-mono text-sm">
          <p className="text-muted">
            <span className="text-accent">$</span> open --links
          </p>
          {links.length ? (
            <ul className="mt-3 space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="hover:text-accent">
                    ↗ {l.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">links coming soon_</p>
          )}
        </div>
      </div>
    </article>
  );
}
