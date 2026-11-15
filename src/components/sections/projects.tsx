import { site } from "@/content/site";
import { Section } from "@/components/ui/section";

/** Card list shell — milestone 3 turns this into the sticky stacking folders + hover + overlay. */
export function Projects() {
  return (
    <Section id="projects" label="projects">
      <ol className="flex flex-col gap-8">
        {site.projects.map((p, i) => (
          <li
            key={p.slug}
            className="flex min-h-[60vh] flex-col justify-between rounded-3xl border border-line bg-surface p-8 sm:p-12"
          >
            <div className="flex items-start justify-between font-mono text-sm text-muted">
              <span>
                <span className="text-accent">{String(i + 1).padStart(2, "0")}</span> / {p.year} · {p.role}
              </span>
              <span>{p.stack.join(" · ")}</span>
            </div>
            <div>
              <h3 className="text-4xl font-semibold tracking-tight sm:text-6xl">{p.title}</h3>
              <p className="mt-3 max-w-xl text-lg text-fg/75">{p.tagline}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
