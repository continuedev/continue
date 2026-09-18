interface RuckusSignetProps {
  /** Height of the signet in pixels */
  height?: number;
  /** Width of the signet in pixels */
  width?: number;
  /** Additional CSS classes to apply to the SVG */
  className?: string;
}

/**
 * The Ruckus mark, without the wordmark. Sized on a 48x48 grid.
 *
 * Placeholder artwork — swap the <path> geometry when the final mark lands,
 * keeping the viewBox and the gradient ids so every call site keeps working.
 */
export default function RuckusSignet({
  height = 48,
  width = 48,
  className = "",
}: RuckusSignetProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Ruckus"
    >
      <defs>
        <linearGradient id="ruckus-signet-fill" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#8f73ff" />
          <stop offset="100%" stopColor="#6344e8" />
        </linearGradient>
      </defs>
      <rect
        width="48"
        height="48"
        rx="13"
        fill="url(#ruckus-signet-fill)"
      />
      {/* Angular "R" — stem, bowl, and kicked leg */}
      <path
        d="M16 12h11.4a8.6 8.6 0 0 1 0 17.2h-2.1L34 38h-7.3l-7.4-9.6V38H16V12Zm3.3 6v5.6h7.6a2.8 2.8 0 0 0 0-5.6h-7.6Z"
        fill="#ffffff"
      />
    </svg>
  );
}
