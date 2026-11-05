import { vscForeground } from "..";

interface ContinuedLogoProps {
  /** Height in pixels; the width follows (mark plus wordmark). */
  height?: number;
}

/**
 * The Continued mark (brand-src/mark.svg: a forward chevron trailing off into
 * dots) with the "Continued" wordmark in the editor's foreground colour.
 */
export default function ContinuedLogo({ height = 75 }: ContinuedLogoProps) {
  return (
    <svg
      height={height}
      viewBox="0 0 1700 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Continued"
    >
      <defs>
        <linearGradient id="continued-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#115E59" />
        </linearGradient>
      </defs>
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        fill="url(#continued-bg)"
      />
      <path
        d="M142 150 L248 256 L142 362"
        fill="none"
        stroke="#F0FDFA"
        strokeWidth="54"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="324" cy="256" r="30" fill="#99F6E4" />
      <circle cx="400" cy="256" r="21" fill="#99F6E4" fillOpacity="0.6" />
      <text
        x="560"
        y="330"
        fill={vscForeground}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="210"
        fontWeight="600"
      >
        Continued
      </text>
    </svg>
  );
}
