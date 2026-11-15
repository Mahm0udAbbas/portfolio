import { site } from "@/content/site";
import { Section } from "@/components/ui/section";

/** Grouped skill keycaps — milestone 6 swaps this for the 3D physics keycap pile (this stays as the fallback). */
export function Skills() {
  return (
    <Section id="skills" label="skills">
      <div className="grid gap-10 sm:grid-cols-2">
        {site.skills.map((g) => (
          <div key={g.label}>
            <h3 className="mb-4 font-mono text-sm text-muted">{g.label}</h3>
            <ul className="flex flex-wrap gap-3">
              {g.items.map((s) => (
                <li
                  key={s}
                  className="rounded-lg border border-line border-b-4 bg-surface-2 px-4 py-2 font-mono text-sm"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
