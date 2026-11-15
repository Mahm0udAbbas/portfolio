import { site } from "@/content/site";
import { Section } from "@/components/ui/section";

export function About() {
  const { bio, stats, portrait } = site.about;
  return (
    <Section id="about" label="about">
      <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt={site.name} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center font-mono text-sm text-muted">[ portrait ]</div>
          )}
        </div>
        <div>
          {bio.map((p) => (
            <p key={p} className="mb-5 text-xl leading-relaxed text-fg/85">
              {p}
            </p>
          ))}
          <dl className="mt-10 grid grid-cols-3 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="border-l border-accent/50 pl-4">
                <dt className="font-mono text-xs text-muted">{s.label}</dt>
                <dd className="mt-1 text-4xl font-semibold">
                  {s.value}
                  {s.suffix}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  );
}
