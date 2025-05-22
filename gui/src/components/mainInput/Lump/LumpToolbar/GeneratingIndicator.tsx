import { AnimatedEllipsis } from "../../..";

export function GeneratingIndicator() {
  return (
    <div className="text-xs text-gray-400">
      <span>Generating</span>
      <AnimatedEllipsis />
    </div>
  );
}
