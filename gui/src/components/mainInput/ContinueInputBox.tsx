import { JSONContent } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import { defaultBorderRadius, vscBackground } from "..";
import { RootStore } from "../../redux/store";
import ContextItemsPeek from "./ContextItemsPeek";
import TipTapEditor from "./TipTapEditor";
import { ComboBoxItemType } from "./types";

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
  }
`;

const GradientBorder = styled.div<{
  borderRadius?: string;
  borderColor?: string;
  isFirst: boolean;
  isLast: boolean;
  loading: boolean;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: 1px;
  background: ${(props) =>
    props.borderColor
      ? props.borderColor
      : `repeating-linear-gradient(
      101.79deg,
      #1BBE84 0%,
      #331BBE 16%,
      #BE1B55 33%,
      #A6BE1B 55%,
      #BE1B55 67%,
      #331BBE 85%,
      #1BBE84 99%
    )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 8px;
`;

interface ContinueInputBoxProps {
  isLastUserInput: boolean;
  isMainInput?: boolean;
  onEnter: (editorState: JSONContent) => void;

  editorState?: JSONContent;
  contextItems?: ContextItemWithId[];
}

function ContinueInputBox(props: ContinueInputBoxProps) {
  const active = useSelector((store: RootStore) => store.state.active);
  const availableSlashCommands = useSelector(
    (state: RootStore) =>
      state.state.config.slashCommands?.map((cmd) => {
        return {
          title: `/${cmd.name}`,
          description: cmd.description,
          type: "slashCommand" as ComboBoxItemType,
        };
      }) || []
  );
  const availableContextProviders = useSelector(
    (store: RootStore) => store.state.config.contextProviders
  );

  return (
    <div
      style={{
        paddingTop: "4px",
        backgroundColor: vscBackground,
      }}
    >
      <div
        className="flex px-2 relative"
        style={{
          backgroundColor: vscBackground,
        }}
      >
        <GradientBorder
          loading={active && props.isLastUserInput}
          isFirst={false}
          isLast={false}
          borderColor={
            active && props.isLastUserInput ? undefined : vscBackground
          }
          borderRadius={defaultBorderRadius}
        >
          <TipTapEditor
            editorState={props.editorState}
            onEnter={props.onEnter}
            isMainInput={props.isMainInput}
            availableContextProviders={availableContextProviders}
            availableSlashCommands={availableSlashCommands}
          ></TipTapEditor>
        </GradientBorder>
      </div>
      <ContextItemsPeek contextItems={props.contextItems}></ContextItemsPeek>
    </div>
  );
}

export default ContinueInputBox;
