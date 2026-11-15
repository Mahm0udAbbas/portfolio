import { site } from "@/content/site";
import { Logo } from "@/components/brand/logo";
import { BugCounter, BugsLayer } from "@/components/bugs/bugs-layer";

/** A normal footer… with 3D bugs crawling over it (click one to fix it). */
export function Footer() {
  const c = site.contact;
  const contact = [
    { label: "email", href: `mailto:${c.email}` },
    { label: "github", href: c.github.url },
    { label: "linkedin", href: c.linkedin.url },
    { label: "cv.pdf", href: c.cv },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-line">
      <BugsLayer />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-12 pt-16 sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="size-9 text-fg" blink={false} />
            <span className="text-lg font-semibold">{site.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-fg/60">{site.tagline}</p>
          <p className="mt-6 font-mono text-xs text-muted">
            press <kbd className="rounded border border-line px-1.5 py-0.5 text-fg">Ctrl K</kbd> for the terminal
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="mb-4 font-mono text-xs text-muted">
            <span className="text-accent">~/</span>sitemap
          </p>
          <ul className="space-y-2">
            {site.nav.map((n) => (
              <li key={n.id}>
                <a href={`/#${n.id}`} className="text-fg/80 transition-colors hover:text-accent">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-4 font-mono text-xs text-muted">
            <span className="text-accent">~/</span>contact
          </p>
          <ul className="space-y-2">
            {contact.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="text-fg/80 transition-colors hover:text-accent"
                  {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 font-mono text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {site.year} {site.name}
          </p>
          <p>
            <BugCounter />
          </p>
          <a href="/#hero" className="hover:text-accent">
            back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
