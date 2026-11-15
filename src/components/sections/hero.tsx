import { site } from "@/content/site";
import { HeroCanvas } from "@/components/hero/hero-canvas";

/**
 * Hero: copy on the left, zero-gravity UI toys (R3F) filling the stage.
 * The section is 200vh with a sticky stage — scrolling scatters the toys before About arrives.
 */
export function Hero() {
  return (
    <section id="hero" className="relative h-[200vh] motion-reduce:h-dvh">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <HeroCanvas />

        <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-6xl items-start px-4 pt-[calc(var(--header-h)+3rem)] sm:px-8 md:items-center md:pt-(--header-h)">
          <div data-hero-copy className="pointer-events-auto max-w-xl">
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
              <a href="#contact" className="rounded-md border border-line bg-bg/40 px-5 py-3 backdrop-blur hover:border-accent">
                ./contact
              </a>
            </div>
            <p className="mt-6 hidden font-mono text-xs text-muted md:block">
              psst — press <kbd className="rounded border border-line px-1.5 py-0.5 text-fg">Ctrl K</kbd> to talk to my
              terminal, or poke the toys →
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
