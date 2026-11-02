import { AnimatedEllipsis } from "../../../AnimatedEllipsis";

export function GeneratingIndicator({
  text = "Generating",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center text-description" data-testid={testId}>
      <span className="text-xs">{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
