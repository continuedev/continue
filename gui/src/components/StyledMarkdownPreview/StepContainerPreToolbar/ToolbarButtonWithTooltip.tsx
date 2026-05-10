import { ReactNode } from "react";
import { ToolTip } from "../../gui/Tooltip";

interface ToolbarButtonWithTooltipProps {
  onClick: () => void;
  children: ReactNode;
  tooltipContent: string;
  "data-testid"?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ToolbarButtonWithTooltip({
  onClick,
  children,
  tooltipContent,
  "data-testid": testId,
  disabled = false,
  ariaLabel,
}: ToolbarButtonWithTooltipProps) {
  return (
    <ToolTip place="top" content={tooltipContent}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) {
            return;
          }
          onClick();
        }}
        data-testid={testId}
        disabled={disabled}
        aria-label={ariaLabel ?? (tooltipContent || undefined)}
        className={`hover:description-muted/30 flex select-none items-center justify-center rounded bg-transparent px-0.5 py-0.5 hover:opacity-80 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        {children}
      </button>
    </ToolTip>
  );
}
