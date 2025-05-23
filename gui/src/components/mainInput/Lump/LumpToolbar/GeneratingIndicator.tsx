import { AnimatedEllipsis } from "../../..";

export function GeneratingIndicator() {
  return (
    <div className="text-description-muted text-xs">
      <span>Generating</span>
      <AnimatedEllipsis />
    </div>
  );
}
