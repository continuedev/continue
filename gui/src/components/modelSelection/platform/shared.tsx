import { ConfigValidationError } from "@continuedev/config-yaml";
import {
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscCommandCenterInactiveBorder,
} from "../..";
import { ToolTip } from "../../gui/Tooltip";

export const OptionDiv = styled.div<{
  isDisabled?: boolean;
  isSelected?: boolean;
}>`
  padding: 6px 12px;

  min-width: 0px;

  ${({ isDisabled, isSelected }) =>
    !isDisabled &&
    `
    cursor: pointer;

    &:hover {
      background: ${lightGray}33;
    }

    ${
      isSelected &&
      `
      background: ${lightGray}22;
    `
    }
  `}

  ${({ isDisabled }) =>
    isDisabled &&
    `
    opacity: 0.5;
  `}
`;

export const MAX_HEIGHT_PX = 300;

export const Divider = styled.div`
  height: 0.5px;
  background-color: ${vscCommandCenterInactiveBorder};
`;

interface ModelOptionProps {
  children: React.ReactNode;
  idx: number;
  disabled: boolean;
  selected: boolean;
  showConfigure: boolean;
  onOpenConfig: () => void;
  onClick: () => void;
  errors?: ConfigValidationError[];
  onClickError?: (e: any) => void;
}

const IconBase = styled.div<{ $hovered: boolean }>`
  width: 1.2em;
  height: 1.2em;
  cursor: pointer;
  padding: 4px;
  border-radius: ${defaultBorderRadius};
  opacity: ${(props) => (props.$hovered ? 0.75 : 0)};
  visibility: ${(props) => (props.$hovered ? "visible" : "hidden")};

  &:hover {
    opacity: 1;
    background-color: ${lightGray}33;
  }
`;

const StyledCog6ToothIcon = styled(IconBase).attrs({ as: Cog6ToothIcon })``;
const StyledArrowTopRightOnSquareIcon = styled(IconBase).attrs({
  as: ArrowTopRightOnSquareIcon,
})``;
const StyledExclamationTriangleIcon = styled(IconBase).attrs({
  as: ExclamationTriangleIcon,
})``;

export function Option({
  children,
  idx,
  disabled,
  onClick,
  showConfigure,
  selected,
  errors,
  onClickError,
  onOpenConfig,
}: ModelOptionProps) {
  const [hovered, setHovered] = useState(false);

  function handleOptionClick(e: any) {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClick();
  }

  return (
    <OptionDiv
      key={idx}
      isDisabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      isSelected={selected}
      onClick={!disabled ? handleOptionClick : undefined}
    >
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex w-full items-center justify-between">
          {children}
          <div className="ml-2 flex items-center">
            {!errors?.length ? (
              showConfigure ? (
                <StyledCog6ToothIcon
                  $hovered={hovered}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenConfig();
                  }}
                />
              ) : (
                <StyledArrowTopRightOnSquareIcon
                  $hovered={hovered}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenConfig();
                  }}
                />
              )
            ) : (
              <>
                <StyledExclamationTriangleIcon
                  data-tooltip-id={`${idx}-errors-tooltip`}
                  $hovered={hovered}
                  className="cursor-pointer text-red-500"
                  onClick={onClickError}
                />
                <ToolTip id={`${idx}-errors-tooltip`}>
                  <div className="font-semibold">Errors</div>
                  {JSON.stringify(errors, null, 2)}
                </ToolTip>
              </>
            )}
          </div>
        </div>
      </div>
    </OptionDiv>
  );
}
