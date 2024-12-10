import { FREE_TRIAL_MODELS } from "core/config/default";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { Button, ButtonSubtext } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { isJetBrains } from "../../../util";
import { useSubmitOnboarding } from "../hooks";
import JetBrainsFetchGitHubTokenDialog from "./JetBrainsFetchGitHubTokenDialog";
import { setDefaultModel } from "../../../redux/slices/configSlice";

function QuickstartSubmitButton() {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  const { submitOnboarding } = useSubmitOnboarding("Quickstart");

  function onComplete() {
    submitOnboarding();

    // Set Sonnet as the default model
    const title = FREE_TRIAL_MODELS[0].title;
    dispatch(setDefaultModel({ title, force: true }));
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
    const result = await ideMessenger.request("getGitHubAuthToken", {
      force: true,
    });

    if (result.status === "success") {
      onComplete();
    } else {
      ideMessenger.post("showToast", [
        "error",
        "Failed to sign up for Continue free trial through GitHub",
      ]);
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
        className="grid w-full grid-flow-col items-center gap-2"
      >
        Get started using our API keys
      </Button>
      <ButtonSubtext>Try 50 chat and 2k autocomplete requests</ButtonSubtext>
    </div>
  );
}

export default QuickstartSubmitButton;
