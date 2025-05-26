import { AnimatedEllipsis } from "../../..";

export function GeneratingIndicator({
  text = "Generating",
}: {
  text?: string;
}) {
  return (
    <div className="text-description-muted text-xs">
      <span>{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
