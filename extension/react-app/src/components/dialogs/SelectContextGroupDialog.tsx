import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../../redux/store";
import { useContext } from "react";
import { GUIClientContext } from "../../App";
import { TrashIcon } from "@heroicons/react/24/outline";
import HeaderButtonWithText from "../HeaderButtonWithText";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import {
  Button,
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  vscForeground,
} from "..";
import styled from "styled-components";

const MiniPillSpan = styled.span`
  padding: 3px;
  padding-left: 6px;
  padding-right: 6px;
  border-radius: ${defaultBorderRadius};
  color: ${vscForeground};
  background-color: #fff3;
  overflow: hidden;
  font-size: 12px;
  display: flex;
  align-items: center;
  text-align: center;
  justify-content: center;
`;

const ContextGroupSelectDiv = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: ${defaultBorderRadius};
  background-color: ${secondaryDark};
  color: ${vscForeground};
  margin-top: 8px;
  cursor: pointer;

  &:hover {
    background-color: ${vscBackground};
    color: ${vscForeground};
  }
`;

function SelectContextGroupDialog() {
  const dispatch = useDispatch();
  const savedContextGroups = useSelector(
    (state: RootStore) => state.serverState.saved_context_groups
  );
  const client = useContext(GUIClientContext);

  return (
    <div className="p-4">
      <h2>Saved Context Groups</h2>

      {savedContextGroups && Object.keys(savedContextGroups).length > 0 ? (
        <div className="overflow-scroll">
          {Object.keys(savedContextGroups).map((key: string) => {
            const contextGroup = savedContextGroups[key];
            return (
              <ContextGroupSelectDiv
                onClick={() => {
                  dispatch(setDialogMessage(undefined));
                  dispatch(setShowDialog(false));
                  client?.selectContextGroup(key);
                }}
              >
                <b>{key}: </b>

                {contextGroup.map((contextItem) => {
                  return (
                    <MiniPillSpan>{contextItem.description.name}</MiniPillSpan>
                  );
                })}
                <HeaderButtonWithText
                  text="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    client?.deleteContextGroup(key);
                  }}
                >
                  <TrashIcon width="1.4em" height="1.4em" />
                </HeaderButtonWithText>
              </ContextGroupSelectDiv>
            );
          })}
        </div>
      ) : (
        <div>No saved context groups</div>
      )}
      <Button
        className="ml-auto"
        onClick={() => {
          dispatch(setDialogMessage(undefined));
          dispatch(setShowDialog(false));
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

export default SelectContextGroupDialog;
