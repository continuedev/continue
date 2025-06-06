import { OnboardingModes } from "core/protocol/core";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { Button, ButtonSubtext } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useSubmitOnboarding } from "../hooks";

interface ApiKeySubmitButtonProps {
  isDialog?: boolean;
}

function ApiKeySubmitButton({ isDialog }: ApiKeySubmitButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();
  const { submitOnboarding } = useSubmitOnboarding(
    OnboardingModes.API_KEYS,
    isDialog,
  );

  function onComplete() {
    submitOnboarding();
  }

  async function onClick() {
    // REMOVED THIS LOGIC TO GET GITHUB TOKEN
    // SINCE NOW USES THE HUB FOR FREE TRIAL
    // AND COMPONENT IS CURRENTLY UNUSED
  }

  return (
    <div className="mt-4 w-full">
      <Button
        onClick={onClick}
        className="grid w-full grid-flow-col items-center gap-2"
      >
        Get started using our API keys
      </Button>
      <ButtonSubtext>Try 50 chat and 2k autocomplete requests</ButtonSubtext>
    </div>
  );
}

export default ApiKeySubmitButton;
