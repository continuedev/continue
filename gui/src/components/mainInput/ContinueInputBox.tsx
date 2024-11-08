import { JSONContent } from "@tiptap/react";
import { ContextItemWithId, InputModifiers } from "core";
import { useDispatch, useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import { defaultBorderRadius, lightGray, vscBackground } from "..";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectSlashCommands } from "../../redux/selectors";
import { newSession, setMessageAtIndex } from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import ContextItemsPeek from "./ContextItemsPeek";
import TipTapEditor from "./TipTapEditor";
import { useMemo, memo, useState, useEffect, useCallback } from "react";
import { isBareChatMode } from "../../util/bareChatMode";
import { getContextProviders } from "../../integrations/util/integrationSpecificContextProviders";
import { getFontSize } from "../../util";
import { cn } from "@/lib/utils";

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

const wave = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.85); opacity: 0.5; }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: ${lightGray};
  font-size: ${getFontSize() - 3}px;
  padding: 0 0.6rem;
  width: 100%;
`;

const DotsContainer = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top 8px;
`;

const Dot = styled.div<{ delay: number }>`
  width: 3px;
  height: 3px;
  background-color: #4DA587;
  border-radius: 50%;
  animation: ${wave} 1.5s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;

  &::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    background: inherit;
    border-radius: inherit;
    animation: ${pulse} 1.5s ease-in-out infinite;
    animation-delay: ${props => props.delay}s;
  }
`;

interface ContinueInputBoxProps {
  isLastUserInput: boolean;
  isMainInput?: boolean;
  onEnter: (editorState: JSONContent, modifiers: InputModifiers) => void;
  editorState?: JSONContent;
  contextItems?: ContextItemWithId[];
  hidden?: boolean;
  source?: "perplexity" | "aider" | "continue";
  className?: string;
}

const ContinueInputBox = memo(function ContinueInputBox({
  isLastUserInput,
  isMainInput,
  onEnter,
  editorState,
  contextItems,
  hidden,
  source = "continue",
  className,
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
        dispatch(newSession({ session: undefined, source }));
        dispatch(
          setMessageAtIndex({
            message: { role: "user", content: data.prompt },
            index: 0,
            contextItems: [],
            source,
          }),
        );
      }
    },
    [isMainInput],
  );

  // check if lastActiveIntegration === source, if so, activate gradient border and tiptap editor
  // actually can get history here and check if last message of passed in source was a lastUserInput
  // Preserve editor state between renders
  const [preservedState, setPreservedState] = useState(editorState);

  useEffect(() => {
    if (editorState) {
      setPreservedState(editorState);
    }
  }, [editorState]);

  const handleEditorChange = useCallback((newState: JSONContent) => {
    setPreservedState(newState);
  }, []);

  return (
    <div
      className={cn(className)}
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
          editorState={preservedState}
          onEnter={onEnter}
          isMainInput={isMainInput}
          availableContextProviders={availableContextProviders}
          availableSlashCommands={
            bareChatMode ? undefined : availableSlashCommands
          }
          source={source}
          onChange={handleEditorChange}
        />
      </GradientBorder>
      {active && isLastUserInput && (
        <LoadingContainer>
          <DotsContainer>
            {[0, 1, 2].map((i) => (
              <Dot key={i} delay={i * 0.2} />
            ))}
          </DotsContainer>
          <span style={{ marginTop: "4px" }}>Responding...</span>
        </LoadingContainer>
      )}
      <ContextItemsPeek contextItems={contextItems}></ContextItemsPeek>
    </div>
  );
});

export default ContinueInputBox;
