import { useMemo } from "react";
import { ToolbarButton } from "./CodeBlockToolbar";
import { Tooltip } from "react-tooltip";
import { lightGray } from "..";

export function ToolbarButtonWithTooltip({
  onClick,
  children,
  tooltipContent,
}) {
  const tooltipId = useMemo(
    () => `tooltip-${Math.random().toString(36).substr(2, 9)}`,
    [],
  );

  return (
    <>
      <ToolbarButton
        onClick={onClick}
        style={{ color: lightGray }}
        data-tooltip-id={tooltipId}
        className="px-1"
      >
        {children}
      </ToolbarButton>
      <Tooltip id={tooltipId} place="top">
        {tooltipContent}
      </Tooltip>
    </>
  );
}
