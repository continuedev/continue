import { useContext } from "react";
import styled from "styled-components";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { getFontSize } from "../../../../util";
import { GeneratingIndicator } from "./GeneratingIndicator";
import { useTranslation } from "react-i18next";

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

export function TtsActiveToolbar() {
  const { t } = useTranslation();
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <Container>
      <GeneratingIndicator />
      <StopButton
        className="text-description"
        onClick={() => {
          ideMessenger.post("tts/kill", undefined);
        }}
      >
        ■ {t("Lump.TtsActiveToolbar.StopTTS")}
      </StopButton>
    </Container>
  );
}
