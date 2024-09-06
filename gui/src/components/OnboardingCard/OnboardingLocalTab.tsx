import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { CopyToTerminalButton, StyledDiv } from "./CopyToTerminalButton";
import { useCompleteOnboarding } from "./utils";
import { CheckMarkHeader } from "./CheckMarkHeader";
import DownloadOllamaButton from "./DownloadOllamaButton";

enum OllamaConnectionStatuses {
  WaitingToDownload = "WaitingToDownload",
  Downloading = "Downloading",
  Verified = "Verified",
}

enum DefaultLocalModels {
  Chat = "llama3",
  Autocomplete = "starcoder2:3b",
  Embeddings = "nomic-embed-text",
}

const REFETCH_MODELS_INTERVAL_MS = 1000;

function OnboardingLocalTab() {
  const ideMessenger = useContext(IdeMessengerContext);

  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[] | undefined
  >(undefined);

  const [ollamaConnectionStatus, setOllamaConnectionStatus] =
    useState<OllamaConnectionStatuses>(
      OllamaConnectionStatuses.WaitingToDownload,
    );

  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);

  const { completeOnboarding } = useCompleteOnboarding();

  const isOllamaConnected =
    ollamaConnectionStatus === OllamaConnectionStatuses.Verified;

  function isModelDownloaded(model: string) {
    if (!downloadedOllamaModels) {
      return false;
    }

    return downloadedOllamaModels.some(
      (ollamaModel) => ollamaModel.startsWith(model), // We use `startsWith` to ignore trailing tags like `:latest`
    );
  }

  function renderOllamaConnectionStatus(status: OllamaConnectionStatuses) {
    switch (status) {
      case OllamaConnectionStatuses.WaitingToDownload:
        return (
          <div className="flex items-start gap-6">
            <p className="leading-relaxed mt-0 flex-1">
              Download, install, and start Ollama
            </p>
            <DownloadOllamaButton
              onClick={() =>
                setOllamaConnectionStatus(OllamaConnectionStatuses.Downloading)
              }
            />
          </div>
        );

      case OllamaConnectionStatuses.Downloading:
        return <p>Checking for connection to Ollama...</p>;

      case OllamaConnectionStatuses.Verified:
        return <></>;

      default:
        return <></>;
    }
  }

  /**
   * The first time we detect that a chat model has been loaded,
   * we send an empty request to load it
   */
  useEffect(() => {
    if (!hasLoadedChatModel && isModelDownloaded(DefaultLocalModels.Chat)) {
      ideMessenger.post("llm/complete", {
        completionOptions: {},
        prompt: "",
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      setHasLoadedChatModel(true);
    }
  }, [downloadedOllamaModels]);

  /**
   * Sets up an interval that runs every `REFETCH_MODELS_INTERVAL_MS`
   * to fetch the list of downloaded models and update state.
   */
  useEffect(() => {
    const fetchDownloadedModels = async () => {
      const models = await ideMessenger.request("llm/listModels", {
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      if (Array.isArray(models)) {
        // If we got a response, the connection has been verified
        if (!isOllamaConnected) {
          setOllamaConnectionStatus(OllamaConnectionStatuses.Verified);
        }

        setDownloadedOllamaModels(models);
      }
    };

    // Immediately invoke to try to minimize jank if a user already has
    // the models installed. A better fix would be to not load the onboarding
    // steps until we've first checked if the user already has the models installed.
    fetchDownloadedModels();

    const interval = setInterval(
      fetchDownloadedModels,
      REFETCH_MODELS_INTERVAL_MS,
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <CheckMarkHeader isComplete={isOllamaConnected}>
          Download Ollama
        </CheckMarkHeader>
        {renderOllamaConnectionStatus(ollamaConnectionStatus)}
      </div>
      <div>
        <CheckMarkHeader
          isComplete={isModelDownloaded(DefaultLocalModels.Chat)}
        >
          Chat
        </CheckMarkHeader>
        {!isModelDownloaded(DefaultLocalModels.Chat) && (
          <div className="flex items-start gap-6">
            <p className="leading-relaxed mt-0 flex-1">
              <code>{DefaultLocalModels.Chat}</code> is the latest open-source
              model trained by Meta
            </p>

            <div className="flex-1">
              <CopyToTerminalButton>
                {`ollama run ${DefaultLocalModels.Chat}`}
              </CopyToTerminalButton>
            </div>
          </div>
        )}
      </div>
      <div>
        <CheckMarkHeader
          isComplete={isModelDownloaded(DefaultLocalModels.Autocomplete)}
        >
          Autcomplete [Optional]
        </CheckMarkHeader>

        {!isModelDownloaded(DefaultLocalModels.Autocomplete) && (
          <div className="flex items-start gap-6">
            <p className="leading-relaxed mt-0 flex-1">
              <code>{DefaultLocalModels.Autocomplete}</code> is a
              state-of-the-art 3B parameter autocomplete model trained by
              Hugging Face
            </p>

            <div className="flex-1">
              <CopyToTerminalButton>
                {`ollama run ${DefaultLocalModels.Autocomplete}`}
              </CopyToTerminalButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingLocalTab;
