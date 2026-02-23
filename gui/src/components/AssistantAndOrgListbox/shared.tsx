import { ConfigValidationError } from "@continuedev/config-yaml";
import {
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import { lightGray } from "..";
import { cn } from "../../util/cn";
import { ToolTip } from "../gui/Tooltip";

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

interface IconBaseProps {
  $hovered: boolean;
  onClick?: (e: any) => void;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

function IconBase({
  $hovered,
  onClick,
  className,
  children,
  ...props
}: IconBaseProps) {
  return (
    <div
      className={cn(
        "rounded-default h-[1.2em] w-[1.2em] cursor-pointer p-1",
        $hovered ? "visible opacity-75" : "invisible opacity-0",
        "hover:bg-lightgray/20 hover:opacity-100",
        className,
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

const StyledCog6ToothIcon = ({
  $hovered,
  onClick,
}: {
  $hovered: boolean;
  onClick?: (e: any) => void;
}) => (
  <IconBase $hovered={$hovered} onClick={onClick}>
    <Cog6ToothIcon />
  </IconBase>
);

const StyledArrowTopRightOnSquareIcon = ({
  $hovered,
  onClick,
}: {
  $hovered: boolean;
  onClick?: (e: any) => void;
}) => (
  <IconBase $hovered={$hovered} onClick={onClick}>
    <ArrowTopRightOnSquareIcon />
  </IconBase>
);

const StyledExclamationTriangleIcon = ({
  $hovered,
  onClick,
  className,
  ...props
}: {
  $hovered: boolean;
  onClick?: (e: any) => void;
  className?: string;
  [key: string]: any;
}) => (
  <IconBase
    $hovered={$hovered}
    onClick={onClick}
    className={className}
    {...props}
  >
    <ExclamationTriangleIcon />
  </IconBase>
);

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
              <ToolTip
                content={
                  <>
                    <div className="font-semibold">Errors</div>
                    {JSON.stringify(errors, null, 2)}
                  </>
                }
              >
                <StyledExclamationTriangleIcon
                  $hovered={hovered}
                  className="cursor-pointer text-red-500"
                  onClick={onClickError}
                />
              </ToolTip>
            )}
          </div>
        </div>
      </div>
    </OptionDiv>
  );
}
