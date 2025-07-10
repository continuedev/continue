import ContinueSignet from "../../../svg/ContinueSignet";

export function GeneratingIndicator({
  text = "Generating",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div
      className="text-description-muted flex items-center"
      data-testid={testId}
    >
      <ContinueSignet className="animate-spin-slow" width={26} height={26} />
      <span className="text-xs">{text}...</span>
    </div>
  );
}
