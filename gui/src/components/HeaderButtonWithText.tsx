import React, { useState } from "react";
import ReactDOM from "react-dom";
import { HeaderButton, StyledTooltip } from ".";

import { v4 as uuidv4 } from "uuid";

interface HeaderButtonWithTextProps {
  text: string;
  onClick?: (e: any) => void;
  children: React.ReactNode;
  disabled?: boolean;
  inverted?: boolean;
  active?: boolean;
  className?: string;
  onKeyDown?: (e: any) => void;
  tabIndex?: number;
  style?: React.CSSProperties;
}

const HeaderButtonWithText = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonWithTextProps
>((props: HeaderButtonWithTextProps, ref) => {
  const [hover, setHover] = useState(false);
  const id = uuidv4();

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <HeaderButton
        data-tooltip-id={`header_button_${id}`}
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
        style={props.style}
        ref={ref}
        tabIndex={props.tabIndex}
      >
        {props.children}
      </HeaderButton>
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id={`header_button_${id}`} place="bottom">
            {props.text}
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
});

export default HeaderButtonWithText;
