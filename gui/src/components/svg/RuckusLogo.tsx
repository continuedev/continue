import RuckusSignet from "./RuckusSignet";

interface RuckusLogoProps {
  /** Height of the lockup in pixels; the width follows the aspect ratio */
  height?: number;
  /** Additional CSS classes to apply to the wrapper */
  className?: string;
}

/**
 * The full Ruckus lockup: mark plus wordmark.
 *
 * The wordmark is set in the app's own type stack rather than outlined paths,
 * so it stays crisp at every size and picks up the theme foreground.
 */
export default function RuckusLogo({
  height = 40,
  className = "",
}: RuckusLogoProps) {
  return (
    <div
      className={`flex items-center gap-[0.32em] ${className}`}
      style={{ height, fontSize: height }}
      role="img"
      aria-label="Ruckus"
    >
      <RuckusSignet height={height} width={height} />
      <span
        className="text-foreground font-semibold leading-none tracking-[-0.03em]"
        style={{ fontSize: "0.72em" }}
      >
        Ruckus
      </span>
    </div>
  );
}
