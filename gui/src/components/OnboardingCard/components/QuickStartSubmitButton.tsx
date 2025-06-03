import { useContext } from "react";
import { useDispatch } from "react-redux";
import { Button, ButtonSubtext } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useSubmitOnboarding } from "../hooks";

interface QuickstartSubmitButtonProps {
  isDialog?: boolean;
}

function QuickstartSubmitButton({ isDialog }: QuickstartSubmitButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  const { submitOnboarding } = useSubmitOnboarding("Quickstart", isDialog);

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

export default QuickstartSubmitButton;
