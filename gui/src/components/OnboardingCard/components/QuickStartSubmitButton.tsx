import { useContext } from "react";
import { Button, ButtonSubtext } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { isJetBrains } from "../../../util";
import { setLocalStorage } from "../../../util/localStorage";
import { useDispatch } from "react-redux";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../redux/slices/uiStateSlice";
import JetBrainsFetchGitHubTokenDialog from "./JetBrainsFetchGitHubTokenDialog";
import { useSubmitOnboarding } from "../hooks";

function QuickstartSubmitButton() {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  const { submitOnboarding } = useSubmitOnboarding("Quickstart");

  function onComplete() {
    setLocalStorage("signedInToGh", true);
    submitOnboarding();
  }

  function openJetBrainsDialog() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <JetBrainsFetchGitHubTokenDialog onComplete={onComplete} />,
      ),
    );
  }

  async function fetchGitHubAuthToken() {
    const result = await ideMessenger.request("getGitHubAuthToken", undefined);
    if (result.status === "success") {
      onComplete();
    }
  }

  async function onClick() {
    if (isJetBrains()) {
      openJetBrainsDialog();
    } else {
      await fetchGitHubAuthToken();
    }
  }

  return (
    <div className="mt-4 w-full">
      <Button
        onClick={onClick}
        className="grid grid-flow-col items-center gap-2 w-full"
      >
        Get started using our API keys
      </Button>
      <ButtonSubtext>Try 50 chat and 2k autocomplete requests</ButtonSubtext>
    </div>
  );
}

export default QuickstartSubmitButton;
