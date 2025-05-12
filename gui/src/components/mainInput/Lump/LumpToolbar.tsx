import { useContext, useEffect } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { AnimatedEllipsis } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectCurrentToolCall } from "../../../redux/selectors/selectCurrentToolCall";
import { callCurrentTool } from "../../../redux/thunks/callCurrentTool";
import { cancelCurrentToolCall } from "../../../redux/thunks/cancelCurrentToolCall";
import { cancelStream } from "../../../redux/thunks/cancelStream";
import {
  getAltKeyLabel,
  getFontSize,
  getMetaKeyLabel,
  isJetBrains,
} from "../../../util";
import { EnterButton } from "../InputToolbar/EnterButton";
import { BlockSettingsTopToolbar } from "./BlockSettingsTopToolbar";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StopButton = styled.div`
  font-size: ${getFontSize() - 3}px;
  padding: 2px;
  padding-right: 4px;
  cursor: pointer;
`;

function GeneratingIndicator() {
  return (
    <div className="text-xs text-gray-400">
      <span>Generating</span>
      <AnimatedEllipsis />
    </div>
  );
}

export function LumpToolbar() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const jetbrains = isJetBrains();

  const toolCallState = useSelector(selectCurrentToolCall);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (toolCallState?.status === "generated") {
      const metaKey = event.metaKey || event.ctrlKey;
      const altKey = event.altKey;

      if (metaKey && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        dispatch(callCurrentTool());
      } else if ((jetbrains ? altKey : metaKey) && event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        dispatch(cancelCurrentToolCall());
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toolCallState]);

  if (ttsActive) {
    return (
      <Container>
        <GeneratingIndicator />
        <StopButton
          className="text-gray-400"
          onClick={() => {
            ideMessenger.post("tts/kill", undefined);
          }}
        >
          ■ Stop TTS
        </StopButton>
      </Container>
    );
  }

  if (isStreaming) {
    return (
      <Container>
        <GeneratingIndicator />
        <StopButton
          className="text-gray-400"
          onClick={() => {
            dispatch(cancelStream());
          }}
        >
          {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
          {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
        </StopButton>
      </Container>
    );
  }

  if (toolCallState?.status === "generated") {
    return (
      <Container>
        <div className="flex flex-row items-center pb-0.5 pr-1 text-xs text-gray-400">
          <span className="hidden sm:flex">Pending tool call</span>
        </div>

        <div className="flex gap-2 pb-0.5">
          <StopButton
            className="text-gray-400"
            onClick={() => dispatch(cancelCurrentToolCall())}
            data-testid="reject-tool-call-button"
          >
            {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
            {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
          </StopButton>
          <EnterButton
            isPrimary={true}
            className="text-gray-400"
            onClick={() => dispatch(callCurrentTool())}
            data-testid="accept-tool-call-button"
          >
            {getMetaKeyLabel()} ⏎ Continue
          </EnterButton>
        </div>
      </Container>
    );
  }

  return <BlockSettingsTopToolbar />;
}
