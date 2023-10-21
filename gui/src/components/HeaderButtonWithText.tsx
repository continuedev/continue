import React, { useState } from "react";
import { HeaderButton, StyledTooltip } from ".";
import ReactDOM from "react-dom";

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
}

const HeaderButtonWithText = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonWithTextProps
>((props: HeaderButtonWithTextProps, ref) => {
  const [hover, setHover] = useState(false);

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

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
        ref={ref}
        tabIndex={props.tabIndex}
      >
        {props.children}
      </HeaderButton>
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id={`header_button_${props.text}`} place="bottom">
            {props.text}
          </StyledTooltip>,
          tooltipPortalDiv
        )}
    </>
  );
});

export default HeaderButtonWithText;
