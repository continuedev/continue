import { ReactNode, useMemo } from "react";
import { Tooltip } from "react-tooltip";
import { getFontSize } from "../../../util";

interface ToolbarButtonWithTooltipProps {
  onClick: () => void;
  children: ReactNode;
  tooltipContent: string;
  "data-testid"?: string;
}

export function ToolbarButtonWithTooltip({
  onClick,
  children,
  tooltipContent,
  "data-testid": testId,
}: ToolbarButtonWithTooltipProps) {
  const tooltipId = useMemo(
    () => `tooltip-${Math.random().toString(36).slice(2, 11)}`,
    [],
  );

  return (
    <>
      <button
        onClick={onClick}
        style={{
          fontSize: `${getFontSize() - 2}px`,
        }}
        data-tooltip-id={tooltipId}
        data-testid={testId}
        className="text-foreground flex items-center border-none bg-transparent px-0.5 outline-none hover:cursor-pointer hover:brightness-125"
      >
        {children}
      </button>
      <Tooltip id={tooltipId} place="top">
        {tooltipContent}
      </Tooltip>
    </>
  );
}
