import { AnimatedEllipsis } from "../../..";

export function GeneratingIndicator({
  text = "Generating",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center" data-testid={testId}>
      <span className="text-description text-xs">{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
