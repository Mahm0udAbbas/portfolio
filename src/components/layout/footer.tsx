import { site } from "@/content/site";

/** Plain footer — milestone 7 adds the crawling 3D bugs on top. */
export function Footer() {
  return (
    <footer className="relative border-t border-line px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 font-mono text-sm text-muted sm:flex-row">
        <p>
          © {site.year} {site.name}
        </p>
        <p>
          <span className="text-accent">0</span> bugs remaining<span className="cursor-blink">_</span>
        </p>
      </div>
    </footer>
  );
}
