import React, { useState } from "react";
import { HeaderButton, StyledTooltip } from ".";

interface HeaderButtonWithTextProps {
  text: string;
  onClick?: (e: any) => void;
  children: React.ReactNode;
  disabled?: boolean;
  inverted?: boolean;
  active?: boolean;
  className?: string;
  onKeyDown?: (e: any) => void;
}

const HeaderButtonWithText = (props: HeaderButtonWithTextProps) => {
  const [hover, setHover] = useState(false);
  return (
    <>
      <HeaderButton
        data-tooltip-id={`header_button_${props.text}`}
        inverted={props.inverted}
        disabled={props.disabled}
        onMouseEnter={() => {
          if (!props.disabled) {
            setHover(true);
          }
        }}
        onMouseLeave={() => {
          setHover(false);
        }}
        onClick={props.onClick}
        onKeyDown={props.onKeyDown}
        className={props.className}
      >
        {props.children}
      </HeaderButton>
      <StyledTooltip id={`header_button_${props.text}`} place="bottom">
        {props.text}
      </StyledTooltip>
    </>
  );
};

export default HeaderButtonWithText;
