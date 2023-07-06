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

  cursor: pointer;
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
      onClick={() => {
        if (props.onDelete) {
          props.onDelete();
        }
      }}
    >
      {props.title}
    </Button>
  );
};

export default PillButton;
