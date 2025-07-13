import { AnimatedEllipsis } from "../../..";

export function GeneratingIndicator({
  text = "Generating",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div className="text-description-muted text-xs" data-testid={testId}>
      <span>{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
