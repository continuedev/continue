import { useEffect, useRef } from "react";
import Spinner from "./Spinner";
import { ApplyState } from "core/protocol/ideWebview";

interface AutoApplyStatusIndicatorsProps {
  applyStateStatus: ApplyState["status"];
  onGeneratingComplete: () => Promise<void>;
  codeBlockContent: string;
  isGenerating: boolean;
}

export default function AutoApplyStatusIndicators({
  isGenerating,
  onGeneratingComplete,
  applyStateStatus,
}: AutoApplyStatusIndicatorsProps) {
  const wasGeneratingRef = useRef(isGenerating);

  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating) {
      onGeneratingComplete();
    }

    wasGeneratingRef.current = isGenerating;
  }, [isGenerating, onGeneratingComplete]);

  if (isGenerating) {
    debugger;
  }

  return (
    <div>
      {isGenerating ? (
        <span className="inline-flex items-center gap-2 text-stone-500">
          Generating
          <Spinner />
        </span>
      ) : applyStateStatus === "streaming" ? (
        <span className="inline-flex items-center gap-2 text-stone-500">
          Applying
          <Spinner />
        </span>
      ) : null}
    </div>
  );
}
