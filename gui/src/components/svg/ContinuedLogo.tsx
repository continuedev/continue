import { vscForeground } from "..";

interface ContinuedLogoProps {
  /** Height in pixels; the width follows (mark plus wordmark). */
  height?: number;
}

/**
 * The Continuous mark (brand-src/mark.svg: an endless loop with a dot
 * travelling along it) with the "Continuous" wordmark in the editor's foreground colour.
 */
export default function ContinuedLogo({ height = 75 }: ContinuedLogoProps) {
  return (
    <svg
      height={height}
      viewBox="0 0 1700 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Continuous"
    >
      <defs>
        <linearGradient id="continuous-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
      </defs>
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        fill="url(#continuous-bg)"
      />
      <path
        d="M256 256 C300 172 412 172 412 256 C412 340 300 340 256 256 C212 172 100 172 100 256 C100 340 212 340 256 256 Z"
        fill="none"
        stroke="#EEF2FF"
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="350.5" cy="193" r="32" fill="#A5F3FC" />
      <text
        x="560"
        y="330"
        fill={vscForeground}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="210"
        fontWeight="600"
      >
        Continuous
      </text>
    </svg>
  );
}
