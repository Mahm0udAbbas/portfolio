import { site } from "@/content/site";

/** Hero shell — the 3D retro workstation replaces the right column in milestone 5. */
export function Hero() {
  return (
    <section id="hero" className="relative flex min-h-dvh items-center px-4 pt-(--header-h) sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 md:grid-cols-2">
        <div>
          <p className="font-mono text-sm text-accent">$ whoami</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">{site.name}</h1>
          <p className="mt-3 font-mono text-lg text-muted">
            {site.role}
            <span className="cursor-blink text-accent">_</span>
          </p>
          <p className="mt-8 max-w-md text-lg text-fg/80">{site.tagline}</p>
          <div className="mt-10 flex flex-wrap gap-4 font-mono text-sm">
            <a href="#projects" className="rounded-md bg-accent px-5 py-3 font-medium text-accent-ink">
              ./view-projects
            </a>
            <a href="#contact" className="rounded-md border border-line px-5 py-3 hover:border-accent">
              ./contact
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-muted">
            psst — press <kbd className="rounded border border-line px-1.5 py-0.5 text-fg">Ctrl K</kbd> to talk to my terminal
          </p>
        </div>
        <div
          aria-hidden="true"
          className="hidden aspect-square place-items-center rounded-2xl border border-dashed border-line font-mono text-sm text-muted md:grid"
        >
          [ 3D workstation — milestone 5 ]
        </div>
      </div>
    </section>
  );
}
