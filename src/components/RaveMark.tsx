/**
 * Rave.ai brand mark — an angular geometric "R" built from a slanted stem,
 * a rounded bowl and a diagonal leg. Inherits the current text color.
 */
export function RaveMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="-6 -6 144 111"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      {/* stem */}
      <path d="M34 0 L32 2 L32 66 L0 98 L0 34 Z" />
      {/* bowl */}
      <path d="M34 0 H99 A33 33 0 0 1 99 66 L34 0 Z" />
      {/* leg */}
      <path d="M32 66 H102 L131 99 H65 Z" />
    </svg>
  );
}
