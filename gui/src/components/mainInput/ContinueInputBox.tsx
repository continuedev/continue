import { Editor, JSONContent } from "@tiptap/react";
import { ContextItemWithId, InputModifiers } from "core";
import { useDispatch } from "react-redux";
import styled, { keyframes } from "styled-components";
import { defaultBorderRadius, vscBackground } from "..";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectSlashCommandComboBoxInputs } from "../../redux/selectors";
import ContextItemsPeek from "./ContextItemsPeek";
import TipTapEditor from "./TipTapEditor";
import { useAppSelector } from "../../redux/hooks";
import { newSession, setMessageAtIndex } from "../../redux/slices/sessionSlice";

interface ContinueInputBoxProps {
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
  const dispatch = useDispatch();

  const active = useAppSelector((state) => state.session.isStreaming);
  const availableSlashCommands = useAppSelector(
    selectSlashCommandComboBoxInputs,
  );
  const availableContextProviders = useAppSelector(
    (state) => state.config.config.contextProviders,
  );
  const useTools = useAppSelector(
    (state) => state.config.config.experimental?.useTools !== false,
  );

  useWebviewListener(
    "newSessionWithPrompt",
    async (data) => {
      if (props.isMainInput) {
        dispatch(newSession());
        dispatch(
          setMessageAtIndex({
            message: { role: "user", content: data.prompt },
            index: 0,
          }),
        );
      }
    },
    [props.isMainInput],
  );

  return (
    <div className={`${props.hidden ? "hidden" : ""}`}>
      <div className={`relative flex px-2`}>
        <GradientBorder
          loading={active && props.isLastUserInput ? 1 : 0}
          borderColor={
            active && props.isLastUserInput ? undefined : vscBackground
          }
          borderRadius={defaultBorderRadius}
        >
          <TipTapEditor
            editorState={props.editorState}
            onEnter={(...args) => {
              props.onEnter(...args);
              if (props.isMainInput) {
                args[2].commands.clearContent(true);
              }
            }}
            isMainInput={props.isMainInput ?? false}
            availableContextProviders={availableContextProviders ?? []}
            availableSlashCommands={availableSlashCommands}
            historyKey="chat"
            toolbarOptions={{
              hideTools: !useTools,
            }}
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
