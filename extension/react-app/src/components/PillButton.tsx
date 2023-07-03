import { useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius } from ".";

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
        <span>{props.title}</span>
        <span
          style={{
            cursor: "pointer",
            color: "red",
            borderLeft: "1px solid black",
            paddingLeft: "4px",
          }}
          hidden={!isHovered}
          onClick={() => {
            props.onDelete?.();
            props.onHover?.(false);
          }}
        >
          X
        </span>
      </div>
    </Button>
  );
};

export default PillButton;
