import React, { useState } from "react";

import { HeaderButton } from ".";

interface HeaderButtonWithTextProps {
  text: string;
  onClick?: (e: any) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const HeaderButtonWithText = (props: HeaderButtonWithTextProps) => {
  const [hover, setHover] = useState(false);
  return (
    <HeaderButton
      disabled={props.disabled}
      style={{ padding: "1px", paddingLeft: hover ? "4px" : "1px" }}
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
