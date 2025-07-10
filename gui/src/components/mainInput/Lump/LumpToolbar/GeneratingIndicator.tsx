import ContinueSignet from "../../../svg/ContinueSignet";

export function GeneratingIndicator({
  text = "Generating",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center" data-testid={testId}>
      <ContinueSignet
        className="animate-spin-slow text-foreground"
        width={26}
        height={26}
      />
      <span className="text-description-muted text-xs">{text}...</span>
    </div>
  );
}
