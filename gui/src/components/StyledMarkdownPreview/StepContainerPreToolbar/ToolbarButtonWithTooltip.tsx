import { ReactNode, useMemo } from "react";
import { ToolTip } from "../../gui/Tooltip";

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
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        data-tooltip-id={tooltipId}
        data-testid={testId}
        className="hover:description-muted/30 flex cursor-pointer select-none items-center justify-center rounded bg-transparent px-0.5 py-0.5 hover:opacity-80"
      >
        {children}
      </div>
      <ToolTip id={tooltipId} place="top">
        {tooltipContent}
      </ToolTip>
    </>
  );
}
