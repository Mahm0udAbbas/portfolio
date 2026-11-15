/**
 * Placeholder mark until a logo option is chosen (see public/brand/).
 * Uses currentColor for strokes and the accent for the cursor.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M10 48V16l14 18 14-18 14 16-14 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="44" y="47" width="12" height="5" rx="1" className="cursor-blink" fill="var(--accent)" />
    </svg>
  );
}
