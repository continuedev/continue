import { useContext, useEffect, useState } from "react";
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
import { setBottomMessage } from "../redux/slices/uiStateSlice";
import { ContextItem } from "../../../schema/FullState";

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
  editing: boolean;
  editingAny: boolean;
  index: number;
  areMultipleItems?: boolean;
  onDelete?: () => void;
}

interface StyledButtonProps {
  borderColor?: string;
  editing?: boolean;
}

const StyledButton = styled(Button)<StyledButtonProps>`
  position: relative;
  border-color: ${(props) => props.borderColor || "transparent"};
  border-width: 1px;
  border-style: solid;

  &:focus {
    outline: none;
    border-color: ${lightGray};
    border-width: 1px;
    border-style: solid;
  }
`;

const PillButton = (props: PillButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const client = useContext(GUIClientContext);

  const [warning, setWarning] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (props.editing && props.item.content.length > 4000) {
      setWarning("Editing such a large range may be slow");
    } else {
      setWarning(undefined);
    }
  }, [props.editing, props.item]);

  const dispatch = useDispatch();

  return (
    <div style={{ position: "relative" }}>
      <StyledButton
        borderColor={props.editing ? (warning ? "red" : undefined) : undefined}
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
                props.item.editable &&
                props.areMultipleItems &&
                props.editingAny
                  ? "1fr 1fr"
                  : "1fr",
              backgroundColor: vscBackground,
            }}
          >
            {props.editingAny &&
              props.item.editable &&
              props.areMultipleItems && (
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
      {props.editing &&
        (warning ? (
          <>
            <CircleDiv
              data-tooltip-id={`circle-div-${props.item.description.name}`}
              className="z-10"
            >
              <ExclamationTriangleIcon
                style={{ margin: "auto" }}
                width="1.0em"
                strokeWidth={2}
              />
            </CircleDiv>
            <StyledTooltip id={`circle-div-${props.item.description.name}`}>
              {warning}
            </StyledTooltip>
          </>
        ) : (
          <>
            <CircleDiv
              data-tooltip-id={`circle-div-${props.item.description.name}`}
              style={{
                backgroundColor: "#8800aa55",
                border: `0.5px solid ${lightGray}`,
                padding: "1px",
                zIndex: 1,
              }}
            >
              <PaintBrushIcon
                style={{ margin: "auto" }}
                width="1.0em"
                strokeWidth={2}
              />
            </CircleDiv>
            <StyledTooltip id={`circle-div-${props.item.description.name}`}>
              Editing this range
            </StyledTooltip>
          </>
        ))}
    </div>
  );
};

export default PillButton;
