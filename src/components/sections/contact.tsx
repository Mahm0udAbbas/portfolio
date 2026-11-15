import { site } from "@/content/site";
import { Section } from "@/components/ui/section";
import { CopyEmail } from "./copy-email";

/** `$ contact --list` */
export function Contact() {
  const c = site.contact;
  const rows = [
    { key: "email", value: c.email, href: `mailto:${c.email}`, copy: true },
    { key: "phone", value: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}` },
    { key: "github", value: `github.com/${c.github.handle}`, href: c.github.url },
    { key: "linkedin", value: `in/${c.linkedin.handle}`, href: c.linkedin.url },
    { key: "cv", value: "cv.pdf ↓", href: c.cv, download: true },
  ];
  return (
    <Section id="contact" label="contact">
      <h2 data-reveal className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
        Let&apos;s build something<span className="text-accent">.</span>
      </h2>
      <p data-reveal className="mt-6 max-w-xl text-lg text-fg/70">
        Open to frontend roles and freelance work. The fastest way to reach me is email.
      </p>

      <div data-reveal className="mt-12 rounded-2xl border border-line bg-surface p-6 font-mono text-sm sm:p-8">
        <p className="text-muted">
          <span className="text-accent">❯</span> contact --list
        </p>
        <dl className="mt-5 grid grid-cols-[5.5rem_1fr] items-center gap-y-4 sm:grid-cols-[7rem_1fr]">
          {rows.map((r) => (
            <div key={r.key} className="contents">
              <dt className="text-muted">{r.key}</dt>
              <dd className="flex min-w-0 items-center gap-3">
                <a
                  href={r.href}
                  className="truncate text-base hover:text-accent sm:text-lg"
                  {...(r.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                  {...(r.download ? { download: true } : {})}
                >
                  {r.value}
                </a>
                {r.copy && <CopyEmail email={c.email} />}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-muted">
          tip: press <kbd className="text-fg">Ctrl K</kbd> and type <span className="text-fg">sudo hire-me</span>
        </p>
      </div>
    </Section>
  );
}
