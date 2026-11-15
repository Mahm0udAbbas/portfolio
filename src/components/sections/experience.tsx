import { site } from "@/content/site";
import { SkiRunStage } from "@/components/experience/ski-run-stage";

/**
 * Experience. Desktop: a scroll-driven 3D ski run with one checkpoint per entry (oldest → newest).
 * Phones / reduced motion (and the server-rendered HTML): the `git log` timeline below.
 */
export function Experience() {
  const chronological = [...site.experience].reverse();

  const timeline = (
    <div className="px-4 py-24 sm:px-8 md:py-32">
      <div className="mx-auto w-full max-w-6xl">
        <p className="mb-10 font-mono text-sm text-muted">
          <span className="text-accent-strong">~/</span>experience
        </p>
        <h2 data-reveal className="mb-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Experience<span className="text-accent-strong">.</span>
        </h2>
        <p data-reveal className="mb-14 font-mono text-sm text-muted">
          <span className="text-accent-strong">$</span> git log --author=&quot;{site.name}&quot; --oneline
        </p>

        <ol data-timeline className="relative pl-10">
          <span aria-hidden="true" className="absolute bottom-0 left-[5px] top-2 w-px bg-line" />
          <span aria-hidden="true" data-timeline-line className="absolute bottom-0 left-[5px] top-2 w-px origin-top bg-accent" />

          {site.experience.map((e) => (
            <li key={e.hash} data-reveal className="relative mb-16 last:mb-0">
              <span
                aria-hidden="true"
                data-timeline-dot
                className="absolute -left-10 top-1.5 size-[11px] rounded-full bg-accent ring-4 ring-bg"
              />
              <p className="font-mono text-sm">
                <span className="text-accent-strong">commit {e.hash}</span>
                <span className="text-muted"> ({e.period})</span>
              </p>
              <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">
                {e.role} <span className="text-muted">@ {e.company}</span>
              </h3>
              {e.location && <p className="mt-1 font-mono text-xs text-muted">{e.location}</p>}
              <ul className="mt-4 space-y-2 text-fg/75">
                {e.points.map((pt) => (
                  <li key={pt} className="flex gap-3">
                    <span className="font-mono text-accent-strong">+</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );

  return (
    <section id="experience" className="relative">
      <SkiRunStage entries={chronological} fallback={timeline} />
    </section>
  );
}
