import type { SectionId } from "@/content/site";

/** Shared section shell: anchor id + terminal-style label. */
export function Section({
  id,
  label,
  className = "",
  children,
}: {
  id: SectionId;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`relative px-4 py-24 sm:px-8 md:py-32 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">
        {label && (
          <p className="mb-10 font-mono text-sm text-muted">
            <span className="text-accent-strong">~/</span>
            {label}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
