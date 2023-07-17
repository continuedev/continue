import { useContext, useState } from "react";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  secondaryDark,
  vscForeground,
} from ".";
import {
  Trash,
  PaintBrush,
  ExclamationTriangle,
} from "@styled-icons/heroicons-outline";
import { GUIClientContext } from "../App";

const Button = styled.button`
  border: none;
  color: ${vscForeground};
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
  align-items: center;
  border-radius: ${defaultBorderRadius};

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

const CircleDiv = styled.div`
  position: absolute;
  top: -10px;
  right: -10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: red;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
`;

interface PillButtonProps {
  onHover?: (arg0: boolean) => void;
  onDelete?: () => void;
  title: string;
  index: number;
  editing: boolean;
  pinned: boolean;
  warning?: string;
  onlyShowDelete?: boolean;
}

const PillButton = (props: PillButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const client = useContext(GUIClientContext);

  return (
    <>
      <div style={{ position: "relative" }}>
        <Button
          style={{
            position: "relative",
            borderColor: props.warning
              ? "red"
              : props.editing
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
            <GridDiv
              style={{
                gridTemplateColumns: props.onlyShowDelete ? "1fr" : "1fr 1fr",
              }}
            >
              {props.onlyShowDelete || (
                <ButtonDiv
                  data-tooltip-id={`edit-${props.index}`}
                  backgroundColor={"#8800aa55"}
                  onClick={() => {
                    client?.setEditingAtIndices([props.index]);
                  }}
                >
                  <PaintBrush
                    style={{ margin: "auto" }}
                    width="1.6em"
                  ></PaintBrush>
                </ButtonDiv>
              )}

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
          {props.editing
            ? "Editing this section (with entire file as context)"
            : "Edit this section"}
        </StyledTooltip>
        <StyledTooltip id={`delete-${props.index}`}>Delete</StyledTooltip>
        {props.warning && (
          <>
            <CircleDiv data-tooltip-id={`circle-div-${props.title}`}>
              <ExclamationTriangle
                style={{ margin: "auto" }}
                width="1.0em"
                strokeWidth={2}
              />
            </CircleDiv>
            <StyledTooltip id={`circle-div-${props.title}`}>
              {props.warning}
            </StyledTooltip>
          </>
        )}
      </div>
    </>
  );
};

export default PillButton;
