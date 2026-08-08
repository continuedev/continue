import { ReactNode } from "react";
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
  return (
    <ToolTip place="top" content={tooltipContent}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        data-testid={testId}
        className="hover:description-muted/30 flex cursor-pointer select-none items-center justify-center rounded bg-transparent px-0.5 py-0.5 hover:opacity-80"
      >
        {children}
      </div>
    </ToolTip>
  );
}
