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
        className={`hover:bg-vsc-input-background select-none px-1 py-0.5 hover:opacity-80 ${isShowing ? "bg-vsc-input-background" : "bg-transparent"}`}
      >
        {`{}`}
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
        <div key={key} className="flex flex-row items-center gap-2 py-0.5">
          <span className="text-lightgray">{key}:</span>
          <code className="line-clamp-1">{value.toString()}</code>
        </div>
      ))}
    </div>
  );
};
