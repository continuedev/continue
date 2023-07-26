import { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import {
  Trash,
  PaintBrush,
  ExclamationTriangle,
} from "@styled-icons/heroicons-outline";
import { GUIClientContext } from "../App";
import { useDispatch } from "react-redux";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
} from "../redux/slices/uiStateSlice";
import { ContextItem } from "../../../schema/FullState";
import { ReactMarkdown } from "react-markdown/lib/react-markdown";
import StyledMarkdownPreview from "./StyledMarkdownPreview";

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
  item: ContextItem;
  warning?: string;
  index: number;
  addingHighlightedCode?: boolean;
}

const PillButton = (props: PillButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const client = useContext(GUIClientContext);

  const dispatch = useDispatch();

  useEffect(() => {
    if (isHovered) {
      dispatch(setBottomMessageCloseTimeout(undefined));
      dispatch(
        setBottomMessage(
          <>
            <b>{props.item.description.name}</b>:{" "}
            {props.item.description.description}
            <pre>
              <code
                style={{
                  fontSize: "11px",
                  backgroundColor: vscBackground,
                  color: vscForeground,
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                }}
              >
                {props.item.content}
              </code>
            </pre>
          </>
        )
      );
    } else {
      dispatch(
        setBottomMessageCloseTimeout(
          setTimeout(() => {
            if (!isHovered) {
              dispatch(setBottomMessage(undefined));
            }
          }, 2000)
        )
      );
    }
  }, [isHovered]);

  return (
    <>
      <div style={{ position: "relative" }}>
        <Button
          style={{
            position: "relative",
            borderColor: props.warning
              ? "red"
              : props.item.editing
              ? "#8800aa"
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
                gridTemplateColumns:
                  props.item.editable && props.addingHighlightedCode
                    ? "1fr 1fr"
                    : "1fr",
                backgroundColor: vscBackground,
              }}
            >
              {props.item.editable && props.addingHighlightedCode && (
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

              <StyledTooltip id={`pin-${props.index}`}>
                Edit this range
              </StyledTooltip>
              <ButtonDiv
                data-tooltip-id={`delete-${props.index}`}
                backgroundColor={"#cc000055"}
                onClick={() => {
                  client?.deleteContextWithIds([props.item.description.id]);
                  dispatch(setBottomMessage(undefined));
                }}
              >
                <Trash style={{ margin: "auto" }} width="1.6em"></Trash>
              </ButtonDiv>
            </GridDiv>
          )}
          {props.item.description.name}
        </Button>
        <StyledTooltip id={`edit-${props.index}`}>
          {props.item.editing
            ? "Editing this section (with entire file as context)"
            : "Edit this section"}
        </StyledTooltip>
        <StyledTooltip id={`delete-${props.index}`}>Delete</StyledTooltip>
        {props.warning && (
          <>
            <CircleDiv
              data-tooltip-id={`circle-div-${props.item.description.name}`}
            >
              <ExclamationTriangle
                style={{ margin: "auto" }}
                width="1.0em"
                strokeWidth={2}
              />
            </CircleDiv>
            <StyledTooltip id={`circle-div-${props.item.description.name}`}>
              {props.warning}
            </StyledTooltip>
          </>
        )}
      </div>
    </>
  );
};

export default PillButton;
