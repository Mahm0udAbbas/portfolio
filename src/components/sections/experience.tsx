import { site } from "@/content/site";
import { Section } from "@/components/ui/section";

/** git-log style timeline — milestone 4 adds the scroll-drawn line. */
export function Experience() {
  return (
    <Section id="experience" label="experience">
      <ol className="relative border-l border-line pl-8">
        {site.experience.map((e) => (
          <li key={e.hash} className="relative mb-14 last:mb-0">
            <span className="absolute -left-[37px] top-1.5 size-3 rounded-full bg-accent" aria-hidden="true" />
            <p className="font-mono text-sm">
              <span className="text-accent">commit {e.hash}</span>
              <span className="text-muted"> · {e.period}</span>
            </p>
            <h3 className="mt-2 text-2xl font-semibold">
              {e.role} <span className="text-muted">@ {e.company}</span>
            </h3>
            <ul className="mt-3 space-y-1 text-fg/75">
              {e.points.map((pt) => (
                <li key={pt}>— {pt}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Section>
  );
}
