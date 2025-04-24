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
        onClick={() => setIsShowing(!isShowing)}
        className={`p-1 hover:opacity-80 ${isShowing ? "bg-red-200" : "bg-white"}`}
      >
        <code>{`{}`}</code>
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
    <div className="ml-7 mt-1">
      {args.map(([key, value]) => (
        <div key={key} className="flex gap-2 py-0.5">
          <span className="text-lightgray">{key}:</span>
          <code className="line-clamp-1">{value.toString()}</code>
        </div>
      ))}
    </div>
  );
};
