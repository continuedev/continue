import React, { useState } from "react";

import { HeaderButton } from ".";

interface HeaderButtonWithTextProps {
  text: string;
  onClick?: (e: any) => void;
  children: React.ReactNode;
  disabled?: boolean;
  inverted?: boolean;
  active?: boolean;
}

const HeaderButtonWithText = (props: HeaderButtonWithTextProps) => {
  const [hover, setHover] = useState(false);
  const paddingLeft = (props.disabled ? (props.active ?  "3px" : "1px"): (hover ? "4px" : "1px"));
  return (
    <HeaderButton
      inverted={props.inverted}
      disabled={props.disabled}
      style={{ padding: (props.active ?  "3px" : "1px"), paddingLeft, borderRadius: (props.active ?  "50%" : undefined) }}
      onMouseEnter={() => {
        if (!props.disabled) {
          setHover(true);
        }
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      onClick={props.onClick}
    >
      <span hidden={!hover}>{props.text}</span>
      {props.children}
    </HeaderButton>
  );
};

export default HeaderButtonWithText;
