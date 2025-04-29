import { ReactNode, useMemo } from "react";
import { Tooltip } from "react-tooltip";
import styled from "styled-components";
import { lightGray, vscForeground } from "../..";
import { getFontSize } from "../../../util";

export const ToolbarButton = styled.button`
  display: flex;
  align-items: center;
  border: none;
  outline: none;
  background: transparent;

  color: ${vscForeground};
  font-size: ${getFontSize() - 2}px;

  &:hover {
    cursor: pointer;
    filter: brightness(1.25);
  }
`;

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
      <ToolbarButton
        onClick={onClick}
        style={{ color: lightGray }}
        data-tooltip-id={tooltipId}
        data-testid={testId}
        className="px-0.5"
      >
        {children}
      </ToolbarButton>
      <Tooltip id={tooltipId} place="top">
        {tooltipContent}
      </Tooltip>
    </>
  );
}
