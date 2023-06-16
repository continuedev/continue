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
      style={{ padding: "3px" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setTimeout(() => {
          setHover(false);
        }, 100);
      }}
      onClick={props.onClick}
    >
      <span hidden={!hover}>{props.text}</span>
      {props.children}
    </HeaderButton>
  );
};

export default HeaderButtonWithText;
