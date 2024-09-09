import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { models } from "../../../pages/AddNewModel/configs/models";
import { CheckMarkHeader } from "../components/CheckMarkHeader";
import { CopyToTerminalButton } from "../components/CopyToTerminalButton";
import DownloadOllamaButton from "../components/DownloadOllamaButton";
import { Button } from "../..";
import { OnboardingTab } from "./types";

enum OllamaConnectionStatuses {
  WaitingToDownload = "WaitingToDownload",
  Downloading = "Downloading",
  Verified = "Verified",
}

const REFETCH_MODELS_INTERVAL_MS = 1000;
const autocompleteModel = "starcoder2:3b";
const {
  llama31Chat: { params: chatModel },
} = models;

function OnboardingLocalTab({ onComplete }: OnboardingTab) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[] | undefined
  >(undefined);

  const [ollamaConnectionStatus, setOllamaConnectionStatus] =
    useState<OllamaConnectionStatuses>(
      OllamaConnectionStatuses.WaitingToDownload,
    );

  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);

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
          <div className="flex flex-col items-start gap-3 xs:gap-6 xs:flex-row">
            <p className="leading-relaxed mt-0 w-full xs:w-auto flex-1">
              Download, install, and start Ollama
            </p>

            <div className="w-full xs:w-auto flex-1">
              <DownloadOllamaButton
                onClick={() =>
                  setOllamaConnectionStatus(
                    OllamaConnectionStatuses.Downloading,
                  )
                }
              />
            </div>
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
    if (!hasLoadedChatModel && isModelDownloaded(chatModel.model)) {
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl">Download Ollama & install models</h1>
        <p className="text-base">
          Get started with the best open source models available
        </p>
      </div>

      <div>
        <CheckMarkHeader isComplete={isOllamaConnected}>
          Download Ollama
        </CheckMarkHeader>
        {renderOllamaConnectionStatus(ollamaConnectionStatus)}
      </div>
      <div>
        <CheckMarkHeader isComplete={isModelDownloaded(chatModel.title)}>
          Chat model: <code>{chatModel.title}</code>
        </CheckMarkHeader>
        {!isModelDownloaded(chatModel.model) && (
          <div className="flex flex-col items-start gap-3 xs:gap-6 xs:flex-row">
            <p className="leading-relaxed mt-0 w-full xs:w-auto flex-1">
              Latest open-source model trained by Meta
            </p>

            <div className="w-full xs:w-auto flex-1">
              <CopyToTerminalButton>
                {`ollama run ${chatModel.model}`}
              </CopyToTerminalButton>
            </div>
          </div>
        )}
      </div>
      <div>
        <CheckMarkHeader
          isOptional
          isComplete={isModelDownloaded(autocompleteModel)}
        >
          Autcomplete model: <code>{autocompleteModel}</code>
        </CheckMarkHeader>

        {!isModelDownloaded(autocompleteModel) && (
          <div className="flex flex-col items-start gap-3 xs:gap-6 xs:flex-row">
            <p className="leading-relaxed mt-0 w-full xs:w-auto flex-1">
              State-of-the-art 3B parameter autocomplete model trained by
              Hugging Face
            </p>

            <div className="w-full xs:w-auto flex-1">
              <CopyToTerminalButton>
                {`ollama run ${autocompleteModel}`}
              </CopyToTerminalButton>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 w-full">
        <Button
          onClick={onComplete}
          className="w-full"
          disabled={!isModelDownloaded(chatModel.title)}
        >
          Complete
        </Button>
      </div>
    </div>
  );
}

export default OnboardingLocalTab;
