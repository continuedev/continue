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
  TrashIcon,
  PaintBrushIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
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
  padding: 4px;
  padding-left: 8px;
  padding-right: 8px;
  overflow: hidden;
  font-size: 13px;

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
  areMultipleItems?: boolean;
  onDelete?: () => void;
}

interface StyledButtonProps {
  warning: string;
  editing?: boolean;
  areMultipleItems?: boolean;
}

const StyledButton = styled(Button)<StyledButtonProps>`
  position: relative;
  border-color: ${(props) =>
    props.warning
      ? "red"
      : props.editing && props.areMultipleItems
      ? vscForeground
      : "transparent"};
  border-width: 1px;
  border-style: solid;

  &:focus {
    outline: none;
    border-color: ${vscForeground};
    border-width: 1px;
    border-style: solid;
  }
`;

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
                  fontSize: "12px",
                  backgroundColor: "transparent",
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
        <StyledButton
          areMultipleItems={props.areMultipleItems}
          warning={props.warning || ""}
          editing={props.item.editing}
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
          className="pill-button"
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              props.onDelete?.();
            }
          }}
        >
          {isHovered && (
            <GridDiv
              style={{
                gridTemplateColumns:
                  props.item.editable && props.areMultipleItems
                    ? "1fr 1fr"
                    : "1fr",
                backgroundColor: vscBackground,
              }}
            >
              {props.item.editable && props.areMultipleItems && (
                <ButtonDiv
                  data-tooltip-id={`edit-${props.index}`}
                  backgroundColor={"#8800aa55"}
                  onClick={() => {
                    client?.setEditingAtIds([
                      props.item.description.id.item_id,
                    ]);
                  }}
                >
                  <PaintBrushIcon style={{ margin: "auto" }} width="1.6em" />
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
                <TrashIcon style={{ margin: "auto" }} width="1.6em" />
              </ButtonDiv>
            </GridDiv>
          )}
          {props.item.description.name}
        </StyledButton>
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
              <ExclamationTriangleIcon
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
