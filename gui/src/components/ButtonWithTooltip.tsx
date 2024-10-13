import React from "react";
import { type PlacesType } from "react-tooltip";
import { HeaderButton } from ".";
import { v4 as uuidv4 } from "uuid";
import { ToolTip } from "./gui/Tooltip"; 

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

const ButtonWithTooltip = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonWithTextProps
>((props: HeaderButtonWithTextProps, ref) => {
  const id = uuidv4();
  const tooltipId = `header_button_${id}`;

  return (
    <>
      <HeaderButton
        hoverBackgroundColor={props.hoverBackgroundColor}
        backgroundColor={props.backgroundColor}
        data-tooltip-id={tooltipId}
        inverted={props.inverted}
        disabled={props.disabled}
        onClick={props.onClick}
        onKeyDown={props.onKeyDown}
        className={props.className}
        style={props.style}
        ref={ref}
        tabIndex={props.tabIndex}
      >
        {props.children}
      </HeaderButton>

      <ToolTip id={tooltipId} place={props.tooltipPlacement ?? "bottom"}>
        {props.text}
      </ToolTip>
    </>
  );
});

export default ButtonWithTooltip;
