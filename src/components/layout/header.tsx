"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { site, type SectionId } from "@/content/site";
import { Logo } from "@/components/brand/logo";
import { OPEN_TERMINAL, lockScroll, scrollToSection } from "@/lib/lenis";

/** Nav left, logo right. Hides on scroll down, returns on scroll up, highlights the current section. */
export function Header() {
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState<SectionId | null>(null);
  const [open, setOpen] = useState(false);
  // On sub-pages (e.g. /projects/x) section links must go back to the home page.
  const base = usePathname() === "/" ? "" : "/";

  // Hide on scroll down / show on scroll up
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section: whichever section crosses the middle band of the viewport
  useEffect(() => {
    const els = ["hero", ...site.nav.map((n) => n.id)]
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id as SectionId);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Mobile menu: pause smooth scroll, close on Escape
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setOpen(false);
    scrollToSection(id); // runs next frame, after the menu has released the scroll lock
  };

  return (
    <header
      data-site-header
      className={`fixed inset-x-0 top-0 z-50 h-(--header-h) border-b border-line/60 bg-bg/70 backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${
        hidden && !open ? "-translate-y-full" : ""
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-8">
        {/* Left: nav (desktop) / menu button (mobile) */}
        <nav aria-label="Primary">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="font-mono text-sm text-fg md:hidden"
          >
            <span className="text-accent-strong">[</span> {open ? "close" : "menu"} <span className="text-accent-strong">]</span>
          </button>

          <ul className="hidden gap-7 font-mono text-sm md:flex">
            {site.nav.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`${base}#${item.id}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`group relative py-1 transition-colors hover:text-fg ${isActive ? "text-accent-strong" : "text-muted"}`}
                  >
                    <span className={`mr-1 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}>
                      ❯
                    </span>
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: terminal launcher + logo — the preloader logo lands exactly on the logo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_TERMINAL))}
            className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-accent-strong"
          >
            <span className="text-accent-strong" aria-hidden="true">
              &gt;_
            </span>
            <kbd className="hidden font-mono sm:inline">Ctrl K</kbd>
            <span className="sr-only">Open command terminal</span>
          </button>
          <a href={`${base}#hero`} data-logo-target aria-label={`${site.name} — back to top`} className="text-fg">
            <Logo className="size-10" />
          </a>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 top-(--header-h) h-[calc(100dvh-var(--header-h))] bg-bg px-4 py-10 md:hidden"
      >
        <ol className="space-y-6">
          {site.nav.map((item, i) => (
            <li key={item.id}>
              <a
                href={`${base}#${item.id}`}
                onClick={(e) => (base ? setOpen(false) : goTo(e, item.id))}
                className={`flex items-baseline gap-4 text-4xl font-semibold ${active === item.id ? "text-accent-strong" : "text-fg"}`}
              >
                <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}
