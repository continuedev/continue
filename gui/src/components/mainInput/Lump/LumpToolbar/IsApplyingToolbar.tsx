import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { getAltKeyLabel, getMetaKeyLabel } from "../../../../util";
import { Container, StopButton } from "./components";
import { GeneratingIndicator } from "./GeneratingIndicator";

export const IsApplyingToolbar = () => {
  const ideMessenger = useContext(IdeMessengerContext);

  const jetbrains = window.location.protocol === "jb-api:";

  return (
    <Container>
      <GeneratingIndicator text="Applying" />
      <StopButton
        className="text-description"
        onClick={() => {
          // Note that this will NOT stop generation but once apply is cancelled will show the Generating/cancel option
          // Apply is prioritized because it can be more catastrophic
          // Intentional to be more WYSIWYG for now
          ideMessenger.post("cancelApply", undefined);
        }}
      >
        {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
        {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
      </StopButton>
    </Container>
  );
};
