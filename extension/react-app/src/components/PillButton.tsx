import { useContext, useState } from "react";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
} from ".";
import { Trash, PaintBrush, MapPin } from "@styled-icons/heroicons-outline";
import { GUIClientContext } from "../App";

const Button = styled.button`
  border: none;
  color: white;
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
  padding: 8px;
  overflow: hidden;

  cursor: pointer;
`;

const GridDiv = styled.div`
  position: absolute;
  left: 0px;
  top: 0px;
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  border-radius: ${defaultBorderRadius};
  overflow: hidden;

  background-color: ${secondaryDark};
`;

const ButtonDiv = styled.div<{ backgroundColor: string }>`
  background-color: ${secondaryDark};
  padding: 3px;
  height: 100%;
  display: flex;
  align-items: center;

  &:hover {
    background-color: ${(props) => props.backgroundColor};
  }
`;

interface PillButtonProps {
  onHover?: (arg0: boolean) => void;
  onDelete?: () => void;
  title: string;
  index: number;
  editing: boolean;
  pinned: boolean;
}

const PillButton = (props: PillButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const client = useContext(GUIClientContext);

  return (
    <>
      <Button
        style={{
          position: "relative",
          borderColor: props.editing
            ? "#8800aa"
            : props.pinned
            ? "#ffff0099"
            : "transparent",
          borderWidth: "1px",
          borderStyle: "solid",
        }}
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
        {isHovered && (
          <GridDiv>
            <ButtonDiv
              data-tooltip-id={`edit-${props.index}`}
              backgroundColor={"#8800aa55"}
              onClick={() => {
                client?.setEditingAtIndices([props.index]);
              }}
            >
              <PaintBrush style={{ margin: "auto" }} width="1.6em"></PaintBrush>
            </ButtonDiv>

            {/* <ButtonDiv
            data-tooltip-id={`pin-${props.index}`}
            backgroundColor={"#ffff0055"}
            onClick={() => {
              client?.setPinnedAtIndices([props.index]);
            }}
          >
            <MapPin style={{ margin: "auto" }} width="1.6em"></MapPin>
          </ButtonDiv> */}
            <StyledTooltip id={`pin-${props.index}`}>
              Edit this range
            </StyledTooltip>
            <ButtonDiv
              data-tooltip-id={`delete-${props.index}`}
              backgroundColor={"#cc000055"}
              onClick={() => {
                if (props.onDelete) {
                  props.onDelete();
                }
              }}
            >
              <Trash style={{ margin: "auto" }} width="1.6em"></Trash>
            </ButtonDiv>
          </GridDiv>
        )}
        {props.title}
      </Button>
      <StyledTooltip id={`edit-${props.index}`}>
        {props.editing ? "Editing this range" : "Edit this range"}
      </StyledTooltip>
      <StyledTooltip id={`delete-${props.index}`}>Delete</StyledTooltip>
    </>
  );
};

export default PillButton;
