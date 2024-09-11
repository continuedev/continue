import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { Button } from "../..";
import OllamaStatus from "../components/OllamaStatus";
import { useCompleteOnboarding, useCheckOllamaModels } from "../hooks";
import OllamaModelDownload from "../components/OllamaModelDownload";
import AddModelButtonSubtext from "../../AddModelButtonSubtext";

const autocompleteModel = "starcoder2:3b";
const chatModel = "llama3.1";

function OnboardingLocalTab() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { completeOnboarding } = useCompleteOnboarding();
  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);
  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[]
  >([]);

  const [isOllamaConnected, setIsOllamaConnected] = useState(false);

  const hasDownloadedChatModel = downloadedOllamaModels.some((ollamaModel) =>
    ollamaModel.startsWith(chatModel),
  );

  const hasDownloadedAutocompleteModel = downloadedOllamaModels.some(
    (ollamaModel) => ollamaModel.startsWith(chatModel),
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
        modelName={chatModel}
        hasDownloaded={hasDownloadedChatModel}
      />

      <OllamaModelDownload
        title="Download Autocomplete model"
        modelName={autocompleteModel}
        hasDownloaded={hasDownloadedAutocompleteModel}
      />

      <div className="mt-4 w-full">
        <Button
          onClick={completeOnboarding}
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
