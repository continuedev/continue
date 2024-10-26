import { JSONContent } from "@tiptap/react";
import { ContextItemWithId, InputModifiers } from "core";
import { useDispatch, useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import { defaultBorderRadius, vscBackground } from "..";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectSlashCommands } from "../../redux/selectors";
import { newSession, setMessageAtIndex } from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import ContextItemsPeek from "./ContextItemsPeek";
import TipTapEditor from "./TipTapEditor";
import { useMemo } from "react";
import { isBareChatMode } from "../../util/bareChatMode";
import { getContextProviders } from "../../integrations/util/integrationSpecificContextProviders";

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
  loading: 0 | 1;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: 2px;
  background: ${(props) =>
    props.borderColor
      ? props.borderColor
      : `repeating-linear-gradient(
      101.79deg,
      #4DA587 0%,
      #EBF5DF 16%,
      #4DA587 33%,
      #EBF5DF 55%,
      #4DA587 67%,
      #4DA587 85%,
      #4DA587 99%
    )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
  width: 100% - 0.6rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 8px;
`;

interface ContinueInputBoxProps {
  isLastUserInput: boolean;
  isMainInput?: boolean;
  onEnter: (editorState: JSONContent, modifiers: InputModifiers) => void;
  editorState?: JSONContent;
  contextItems?: ContextItemWithId[];
  hidden?: boolean;
  source?: "perplexity" | "aider" | "continue";
}

function ContinueInputBox({
  isLastUserInput,
  isMainInput,
  onEnter,
  editorState,
  contextItems,
  hidden,
  source = "continue",
}: ContinueInputBoxProps) {
  const dispatch = useDispatch();

  const active = useSelector((store: RootState) => {
    switch (source) {
      case "perplexity":
        return store.state.perplexityActive;
      case "aider":
        return store.state.aiderActive;
      default:
        return store.state.active;
    }
  });

  const availableSlashCommands = useSelector(selectSlashCommands);
  let availableContextProviders = getContextProviders();
  const bareChatMode = isBareChatMode();

  useWebviewListener(
    "newSessionWithPrompt",
    async (data) => {
      if (isMainInput) {
        dispatch(newSession({session: undefined, source}));
        dispatch(
          setMessageAtIndex({
            message: { role: "user", content: data.prompt },
            index: 0,
          }),
        );
      }
    },
    [isMainInput],
  );

  // check if lastActiveIntegration === source, if so, activate gradient border and tiptap editor
  // actually can get history here and check if last message of passed in source was a lastUserInput
  return (
    <div
      style={{
        display: hidden ? "none" : "inherit",
      }}
    >
      <GradientBorder
        loading={active && isLastUserInput ? 1 : 0}
        isFirst={false}
        isLast={false}
        borderColor={active && isLastUserInput ? undefined : vscBackground}
        borderRadius={defaultBorderRadius}
      >
        <TipTapEditor
          editorState={editorState}
          onEnter={onEnter}
          isMainInput={isMainInput}
          availableContextProviders={availableContextProviders}
          availableSlashCommands={
            bareChatMode ? undefined : availableSlashCommands
          }
          source={source}
        ></TipTapEditor>
      </GradientBorder>
      <ContextItemsPeek contextItems={contextItems}></ContextItemsPeek>
    </div>
  );
}

export default ContinueInputBox;
