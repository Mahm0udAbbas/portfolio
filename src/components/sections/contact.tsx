import { site } from "@/content/site";
import { Section } from "@/components/ui/section";

/** `$ contact --list` — copy-email button arrives in milestone 4. */
export function Contact() {
  const c = site.contact;
  const rows = [
    { key: "email", value: c.email, href: `mailto:${c.email}` },
    { key: "phone", value: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}` },
    { key: "github", value: c.github.handle, href: c.github.url },
    { key: "linkedin", value: c.linkedin.handle, href: c.linkedin.url },
    { key: "cv", value: "download cv.pdf", href: c.cv },
  ];
  return (
    <Section id="contact" label="contact">
      <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">Let&apos;s build something.</h2>
      <div className="mt-10 rounded-2xl border border-line bg-surface p-6 font-mono text-sm sm:p-8">
        <p className="text-muted">
          <span className="text-accent">$</span> contact --list
        </p>
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-y-3">
          {rows.map((r) => (
            <div key={r.key} className="contents">
              <dt className="text-muted">{r.key}</dt>
              <dd>
                <a href={r.href} className="hover:text-accent" {...(r.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                  {r.value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
