import { AnimatedEllipsis } from "../../../AnimatedEllipsis";
import i18n from "i18next";

export function GeneratingIndicator({
  text = i18n.t("Lump.GeneratingIndicator.Generating"),
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div className="text-description flex items-center" data-testid={testId}>
      <span className="text-xs">{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
