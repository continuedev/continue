import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray } from "../..";

export const OptionDiv = styled.div<{
  isDisabled?: boolean;
  isSelected?: boolean;
}>`
  border-radius: ${defaultBorderRadius};
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
  background-color: ${lightGray};
`;

interface ModelOptionProps {
  children: React.ReactNode;
  idx: number;
  disabled: boolean;
  selected: boolean;
  showConfigure: boolean;
  onConfigure: (e: any) => void;
  onClick: () => void;
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

export function Option({
  onConfigure,
  children,
  idx,
  disabled,
  onClick,
  showConfigure,
  selected,
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
      onClick={handleOptionClick}
    >
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex w-full items-center justify-between">
          {children}
          <div className="ml-5 flex items-center">
            {showConfigure && (
              <StyledCog6ToothIcon $hovered={hovered} onClick={onConfigure} />
            )}
          </div>
        </div>
      </div>
    </OptionDiv>
  );
}
