/**
 * Rave.ai brand mark — a minimalist gradient "orbit" glyph:
 * a soft squircle ring with a solid core.
 */
export function RaveMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="rave-mark-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M24 4c11.05 0 20 8.95 20 20s-8.95 20-20 20S4 35.05 4 24"
        stroke="url(#rave-mark-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="7" fill="url(#rave-mark-grad)" />
    </svg>
  );
}
