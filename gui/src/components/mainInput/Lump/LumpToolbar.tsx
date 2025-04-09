import { useContext } from "react";
import styled from "styled-components";
import { AnimatedEllipsis } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { cancelStream } from "../../../redux/thunks/cancelStream";
import { getFontSize, getMetaKeyLabel } from "../../../util";
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
          {getMetaKeyLabel()} ⌫ Cancel
        </StopButton>
      </Container>
    );
  }

  return <BlockSettingsTopToolbar />;
}
