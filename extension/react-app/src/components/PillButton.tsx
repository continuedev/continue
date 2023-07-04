import { useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius } from ".";
import { XMark } from "@styled-icons/heroicons-outline";

const Button = styled.button`
  border: none;
  color: white;
  background-color: transparent;
  border: 1px solid white;
  border-radius: ${defaultBorderRadius};
  padding: 3px 6px;

  &:hover {
    background-color: white;
    color: black;
  }
`;

interface PillButtonProps {
  onHover?: (arg0: boolean) => void;
  onDelete?: () => void;
  title: string;
}

const PillButton = (props: PillButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Button
      onMouseEnter={() => {
        setIsHovered(true);
        if (props.onHover) {
          props.onHover(true);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (props.onHover) {
          props.onHover(false);
        }
      }}
    >
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px" }}
      >
        <span
          style={{
            cursor: "pointer",
            color: "red",
            borderRight: "1px solid black",
            paddingRight: "4px",
          }}
          hidden={!isHovered}
          onClick={() => {
            props.onDelete?.();
            props.onHover?.(false);
          }}
        >
          <XMark style={{ padding: "0px" }} size="1.2em" strokeWidth="2px" />
        </span>
        <span>{props.title}</span>
      </div>
    </Button>
  );
};

export default PillButton;
