import { CodeBracketIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";

interface ArgsToggleIconProps {
  isShowing: boolean;
  setIsShowing: (val: boolean) => void;
  toolCallId: string;
}

export const ArgsToggleIcon = ({
  isShowing,
  setIsShowing,
  toolCallId,
}: ArgsToggleIconProps) => {
  const argsTooltipId = useMemo(() => {
    return "args-hover-" + toolCallId;
  }, [toolCallId]);

  return (
    <>
      <div
        data-tooltip-id={argsTooltipId}
        onClick={(e) => {
          e.stopPropagation();
          setIsShowing(!isShowing);
        }}
        className={`hover:description-muted/30 cursor-pointer select-none rounded px-1 py-0.5 hover:opacity-80 ${isShowing ? "bg-description-muted/30" : "bg-transparent"}`}
      >
        <CodeBracketIcon className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
      </div>
      <ToolTip id={argsTooltipId}>
        {isShowing ? "Hide args" : "Show args"}
      </ToolTip>
    </>
  );
};

interface ArgsItemsProps {
  isShowing: boolean;
  args: [string, string][];
}

export const ArgsItems = ({ args, isShowing }: ArgsItemsProps) => {
  if (args.length === 0) {
    return null;
  }

  if (!isShowing) {
    return null;
  }

  return (
    <div className="ml-5 mr-2 mt-1 flex flex-col text-xs">
      {args.map(([key, value]) => (
        <div key={key} className="flex flex-row items-center gap-2 py-0.5">
          <span className="text-lightgray">{key}:</span>
          <code className="line-clamp-1 break-all">
            {JSON.stringify(value)}
          </code>
        </div>
      ))}
    </div>
  );
};
