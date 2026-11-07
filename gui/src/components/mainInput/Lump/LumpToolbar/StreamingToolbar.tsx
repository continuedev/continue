import { useAppSelector } from "../../../../redux/hooks";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";
import { formatPromptProgress } from "../../../../util/promptProgress";
import { GeneratingIndicator } from "./GeneratingIndicator";

interface StreamingToolbarProps {
  onStop: () => void;
  displayText?: string;
}

export function StreamingToolbar({
  onStop,
  displayText = "Stop",
}: StreamingToolbarProps) {
  const jetbrains = isJetBrains();
  // While a local server reads a long prompt, say how far it is
  const progress = useAppSelector((state) => state.session.promptProgress);

  return (
    <div className="flex w-full items-center justify-between">
      {progress ? (
        <GeneratingIndicator
          text={formatPromptProgress(progress)}
          testId="prompt-progress"
        />
      ) : (
        <GeneratingIndicator />
      )}
      <div
        onClick={onStop}
        className="cursor-pointer px-1.5 py-0.5 text-2xs hover:brightness-125"
      >
        <span className="text-description">{displayText}</span>
        {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
        <span className="ml-1 text-description-muted opacity-75">
          {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()}⌫
        </span>
      </div>
    </div>
  );
}
