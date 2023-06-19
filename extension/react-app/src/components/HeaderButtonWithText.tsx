import React, { useState } from "react";

import { HeaderButton } from ".";

interface HeaderButtonWithTextProps {
  text: string;
  onClick?: (e: any) => void;
  children: React.ReactNode;
}

const HeaderButtonWithText = (props: HeaderButtonWithTextProps) => {
  const [hover, setHover] = useState(false);
  return (
    <HeaderButton
      style={{ padding: "1px", paddingLeft: hover ? "4px" : "1px" }}
      onMouseEnter={() => setHover(true)}
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
