import { AnimatedEllipsis } from "../../..";

export function GeneratingIndicator({
  text = "Generating",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div
      className="text-description flex items-center text-xs"
      data-testid={testId}
    >
      <span>{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
