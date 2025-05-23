import styled from "styled-components";
import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks";
import {
  getAltKeyLabel,
  getFontSize,
  getMetaKeyLabel,
  isJetBrains,
} from "../../../../util";
import { GeneratingIndicator } from "./GeneratingIndicator";

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

export function StreamingToolbar() {
  const dispatch = useAppDispatch();
  const jetbrains = isJetBrains();

  return (
    <Container>
      <GeneratingIndicator />
      <StopButton
        className="text-description"
        onClick={() => {
          void dispatch(cancelStream());
        }}
      >
        {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
      </StopButton>
    </Container>
  );
}
