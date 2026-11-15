/**
 * "Prompt M" mark — the M's right leg becomes a `>` prompt, followed by an accent cursor.
 * Strokes use currentColor. `pathLength=1` lets GSAP draw it via stroke-dashoffset (0 → 1).
 */
export function Logo({ className, blink = true }: { className?: string; blink?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" overflow="visible">
      <path
        data-logo-stroke
        d="M10 48V16l14 18 14-18 14 16-14 16"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        data-logo-cursor
        x="44"
        y="47"
        width="12"
        height="5"
        rx="1"
        fill="var(--accent)"
        className={blink ? "cursor-blink" : undefined}
      />
    </svg>
  );
}
