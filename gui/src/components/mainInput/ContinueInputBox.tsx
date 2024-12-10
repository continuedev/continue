import { Editor, JSONContent } from "@tiptap/react";
import { ContextItemWithId, InputModifiers } from "core";
import { useDispatch } from "react-redux";
import styled, { keyframes } from "styled-components";
import { defaultBorderRadius, vscBackground } from "..";
import { selectSlashCommandComboBoxInputs } from "../../redux/selectors";
import ContextItemsPeek from "./ContextItemsPeek";
import TipTapEditor from "./TipTapEditor";
import { useAppSelector } from "../../redux/hooks";
import { ToolbarOptions } from "./InputToolbar";
import { useMemo } from "react";

interface ContinueInputBoxProps {
  isEditMode?: boolean;
  isLastUserInput: boolean;
  isMainInput?: boolean;
  onEnter: (
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) => void;
  editorState?: JSONContent;
  contextItems?: ContextItemWithId[];
  hidden?: boolean;
}

const EDIT_DISALLOWED_CONTEXT_PROVIDERS = [
  "codebase",
  "tree",
  "open",
  "web",
  "diff",
  "folder",
  "search",
  "debugger",
  "repo-map",
];

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
  loading: 0 | 1;
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
`;

function ContinueInputBox(props: ContinueInputBoxProps) {
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const availableSlashCommands = useAppSelector(
    selectSlashCommandComboBoxInputs,
  );
  const availableContextProviders = useAppSelector(
    (state) => state.config.config.contextProviders,
  );
  const useTools = useAppSelector(
    (state) => state.config.config.experimental?.useTools !== false,
  );
  const editModeState = useAppSelector((state) => state.editModeState);

  const filteredSlashCommands = props.isEditMode ? [] : availableSlashCommands;
  const filteredContextProviders = useMemo(() => {
    if (!props.isEditMode) {
      return availableContextProviders ?? [];
    }

    return (
      availableContextProviders?.filter(
        (provider) =>
          !EDIT_DISALLOWED_CONTEXT_PROVIDERS.includes(provider.title),
      ) ?? []
    );
  }, [availableContextProviders]);

  const isStreamingEdit =
    editModeState.editStatus === "streaming" ||
    editModeState.editStatus === "accepting";

  const historyKey = props.isEditMode ? "edit" : "chat";
  const placeholder = props.isEditMode
    ? "Describe how to modify the code - use '#' to add files"
    : undefined;
  const toolbarOptions: ToolbarOptions = props.isEditMode
    ? {
        hideAddContext: false,
        hideImageUpload: false,
        hideUseCodebase: true,
        hideSelectModel: false,
        hideTools: true,
        enterText: isStreamingEdit ? "Retry" : "Edit",
      }
    : {
        hideTools: !useTools,
      };

  return (
    <div className={`${props.hidden ? "hidden" : ""}`}>
      <div className={`relative flex flex-col px-2`}>
        <GradientBorder
          loading={isStreaming && props.isLastUserInput ? 1 : 0}
          borderColor={
            isStreaming && props.isLastUserInput ? undefined : vscBackground
          }
          borderRadius={defaultBorderRadius}
        >
          <TipTapEditor
            editorState={props.editorState}
            onEnter={props.onEnter}
            placeholder={placeholder}
            isMainInput={props.isMainInput ?? false}
            availableContextProviders={filteredContextProviders}
            availableSlashCommands={filteredSlashCommands}
            historyKey={historyKey}
            toolbarOptions={toolbarOptions}
          />
        </GradientBorder>
      </div>
      <ContextItemsPeek
        contextItems={props.contextItems}
        isCurrentContextPeek={props.isLastUserInput}
      />
    </div>
  );
}

export default ContinueInputBox;
