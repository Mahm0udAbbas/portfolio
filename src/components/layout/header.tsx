import { site } from "@/content/site";
import { Logo } from "@/components/brand/logo";

/**
 * Static header shell — nav left, logo right.
 * Milestone 2 adds: hide-on-scroll, active section, mobile menu, and the preloader logo landing here.
 */
export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-(--header-h) border-b border-line/60 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-8">
        <nav aria-label="Primary">
          <ul className="flex gap-6 font-mono text-sm">
            {site.nav.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-muted transition-colors hover:text-accent">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href="#hero" aria-label={`${site.name} — home`} className="text-fg">
          <Logo className="size-10" />
        </a>
      </div>
    </header>
  );
}
