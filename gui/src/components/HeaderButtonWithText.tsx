import React, { useState } from "react";
import ReactDOM from "react-dom";
import { HeaderButton, StyledTooltip } from ".";
import { type PlacesType } from "react-tooltip";

import { v4 as uuidv4 } from "uuid";

interface HeaderButtonWithTextProps {
  text: string | undefined;
  onClick?: (e: any) => void;
  children: React.ReactNode;
  disabled?: boolean;
  inverted?: boolean;
  active?: boolean;
  className?: string;
  onKeyDown?: (e: any) => void;
  tabIndex?: number;
  style?: React.CSSProperties;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  tooltipPlacement?: PlacesType;
}

const HeaderButtonWithText = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonWithTextProps
>((props: HeaderButtonWithTextProps, ref) => {
  const [hover, setHover] = useState(false);
  const id = uuidv4();

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");
  const tooltipId = `header_button_${id}`;

  return (
    <>
      <HeaderButton
        hoverBackgroundColor={props.hoverBackgroundColor}
        backgroundColor={props.backgroundColor}
        data-tooltip-id={tooltipId}
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
      {props.text &&
        tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip
            id={tooltipId}
            place={props.tooltipPlacement ?? "bottom"}
          >
            {props.text}
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
});

export default HeaderButtonWithText;
