import { useContext } from "react";
import styled from "styled-components";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  clearLastEmptyResponse,
  setInactive,
} from "../../../redux/slices/sessionSlice";
import { getFontSize, getMetaKeyLabel } from "../../../util";
import { BlockSettingsTopToolbar } from "./BlockSettingsTopToolbar";

const Container = styled.div`
  display: flex;
  justify-content: flex-end;
  width: 100%;
`;

const StopButton = styled.div`
  font-size: ${getFontSize() - 3}px;
  padding: 2px;
  padding-right: 4px;
  cursor: pointer;
`;

interface TopToolbarProps {
  selectedSection: string | null;
  setSelectedSection: (value: string | null) => void;
}

export function LumpToolbar(props: TopToolbarProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  if (ttsActive) {
    return (
      <Container>
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
        <StopButton
          className="text-gray-400"
          onClick={() => {
            dispatch(setInactive());
            dispatch(clearLastEmptyResponse());
          }}
        >
          {getMetaKeyLabel()} ⌫ Cancel
        </StopButton>
      </Container>
    );
  }

  return (
    <BlockSettingsTopToolbar
      selectedSection={props.selectedSection}
      setSelectedSection={props.setSelectedSection}
    />
  );
}
