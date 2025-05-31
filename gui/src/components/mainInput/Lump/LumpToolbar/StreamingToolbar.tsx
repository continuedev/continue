import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";
import { Container, StopButton } from "./components";
import { GeneratingIndicator } from "./GeneratingIndicator";

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
