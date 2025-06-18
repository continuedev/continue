import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks";
import { getAltKeyLabel, getMetaKeyLabel } from "../../../../util";
import { Container, StopButton } from "./components";
import { GeneratingIndicator } from "./GeneratingIndicator";

export const IsApplyingToolbar = () => {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const jetbrains = window.location.protocol === "jb-api:";

  return (
    <Container>
      <GeneratingIndicator text="Applying" testId={"notch-applying-text"} />
      <StopButton
        data-testid="notch-applying-cancel-button"
        className="text-description"
        onClick={() => {
          // Note that this will NOT stop generation but once apply is cancelled will show the Generating/cancel option
          // Apply is prioritized because it can be more catastrophic
          // Intentional to be more WYSIWYG for now
          // Keyboard shortcut is handled in chat
          void dispatch(cancelStream());
          ideMessenger.post("rejectDiff", {});
        }}
      >
        {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
        {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
      </StopButton>
    </Container>
  );
};
