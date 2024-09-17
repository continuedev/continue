import {
  LOCAL_ONBOARDING_CHAT_MODEL,
  LOCAL_ONBOARDING_CHAT_TITLE,
  LOCAL_ONBOARDING_FIM_MODEL,
  ONBOARDING_LOCAL_MODEL_TITLE,
} from "core/config/onboarding";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Button } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { setDefaultModel } from "../../../redux/slices/stateSlice";
import { hasPassedFTL } from "../../../util/freeTrial";
import AddModelButtonSubtext from "../../AddModelButtonSubtext";
import OllamaModelDownload from "../components/OllamaModelDownload";
import { OllamaStatus } from "../components/OllamaStatus";
import { useCheckOllamaModels, useSubmitOnboarding } from "../hooks";

function OnboardingLocalTab() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { submitOnboarding } = useSubmitOnboarding(
    hasPassedFTL() ? "LocalAfterFreeTrial" : "Local",
  );
  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);
  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[]
  >([]);

  const [isOllamaConnected, setIsOllamaConnected] = useState(false);

  const hasDownloadedChatModel = downloadedOllamaModels.some((ollamaModel) =>
    ollamaModel.startsWith(LOCAL_ONBOARDING_CHAT_MODEL),
  );

  const hasDownloadedAutocompleteModel = downloadedOllamaModels.some(
    (ollamaModel) => ollamaModel.startsWith(LOCAL_ONBOARDING_CHAT_MODEL),
  );

  /**
   * The first time we detect that a chat model has been loaded,
   * we send an empty request to load it
   */
  useEffect(() => {
    if (!hasLoadedChatModel && hasDownloadedChatModel) {
      ideMessenger.post("llm/complete", {
        completionOptions: {},
        prompt: "",
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      setHasLoadedChatModel(true);
    }
  }, [downloadedOllamaModels, isOllamaConnected]);

  useCheckOllamaModels((models) => {
    setDownloadedOllamaModels(models);
  });

  function onConnectionVerified() {
    setIsOllamaConnected(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <p className="text-lg font-bold leading-tight mb-2">Install Ollama</p>
        <OllamaStatus onConnectionVerified={onConnectionVerified} />
      </div>

      <OllamaModelDownload
        title="Download Chat model"
        modelName={LOCAL_ONBOARDING_CHAT_MODEL}
        hasDownloaded={hasDownloadedChatModel}
      />

      <OllamaModelDownload
        title="Download Autocomplete model"
        modelName={LOCAL_ONBOARDING_FIM_MODEL}
        hasDownloaded={hasDownloadedAutocompleteModel}
      />

      <div className="mt-4 w-full">
        <Button
          onClick={() => {
            submitOnboarding();

            // Set the selected model to the local chat model
            dispatch(
              setDefaultModel({
                title: LOCAL_ONBOARDING_CHAT_TITLE,
                force: true, // Because it doesn't exist in the webview's config object yet
              }),
            );
          }}
          className="w-full"
          disabled={!hasDownloadedChatModel}
        >
          Connect
        </Button>
        <AddModelButtonSubtext />
      </div>
    </div>
  );
}

export default OnboardingLocalTab;
