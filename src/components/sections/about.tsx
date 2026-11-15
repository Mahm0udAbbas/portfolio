import { site } from "@/content/site";
import { Section } from "@/components/ui/section";

export function About() {
  const { bio, stats, portrait } = site.about;
  return (
    <Section id="about" label="about">
      <div className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-16">
        <div data-reveal className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt={site.name} className="size-full object-cover" />
          ) : (
            <div
              className="grid size-full place-items-center font-mono text-sm text-muted"
              style={{
                backgroundImage:
                  "radial-gradient(80% 60% at 30% 20%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)",
              }}
            >
              [ portrait.jpg ]
            </div>
          )}
          <span className="absolute bottom-3 left-3 rounded bg-bg/80 px-2 py-1 font-mono text-[11px] text-muted backdrop-blur">
            {site.location}
          </span>
        </div>

        <div>
          <h2 data-reveal className="mb-8 text-4xl font-semibold tracking-tight sm:text-5xl">
            Hi, I&apos;m {site.name.split(" ")[0]}<span className="text-accent">.</span>
          </h2>
          <div data-reveal data-reveal-children>
            {bio.map((p) => (
              <p key={p} className="mb-5 text-xl leading-relaxed text-fg/80">
                {p}
              </p>
            ))}
          </div>
          <dl data-reveal data-reveal-children className="mt-12 grid grid-cols-3 gap-4 sm:gap-6">
            {stats.map((s) => (
              <div key={s.label} className="border-l border-accent/50 pl-4">
                <dt className="font-mono text-xs text-muted">{s.label}</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums sm:text-5xl">
                  <span data-count={s.value}>{s.value}</span>
                  <span className="text-accent">{s.suffix}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  );
}
