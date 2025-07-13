import {
  LOCAL_ONBOARDING_CHAT_MODEL,
  LOCAL_ONBOARDING_CHAT_TITLE,
  LOCAL_ONBOARDING_EMBEDDINGS_MODEL,
  LOCAL_ONBOARDING_FIM_MODEL,
  LOCAL_ONBOARDING_PROVIDER_TITLE,
} from "core/config/onboarding";
import { OnboardingModes } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { Button } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { useSubmitOnboarding } from "../hooks/useSubmitOnboarding";
import OllamaModelDownload from "./OllamaModelDownload";
import { OllamaStatus } from "./OllamaStatus";

const OLLAMA_CHECK_INTERVAL_MS = 3000;

interface OnboardingLocalTabProps {
  isDialog?: boolean;
}

export function OnboardingLocalTab({ isDialog }: OnboardingLocalTabProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { submitOnboarding } = useSubmitOnboarding(
    OnboardingModes.LOCAL,
    isDialog,
  );
  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);
  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[]
  >([]);
  const { selectedProfile } = useAuth();

  const [isOllamaConnected, setIsOllamaConnected] = useState(false);

  const hasDownloadedChatModel = Array.isArray(downloadedOllamaModels)
    ? downloadedOllamaModels.some(
        (ollamaModel) => ollamaModel === LOCAL_ONBOARDING_CHAT_MODEL,
      )
    : false;

  const hasDownloadedAutocompleteModel = Array.isArray(downloadedOllamaModels)
    ? downloadedOllamaModels.some(
        (ollamaModel) => ollamaModel === LOCAL_ONBOARDING_FIM_MODEL,
      )
    : false;

  const hasDownloadedEmbeddingsModel = Array.isArray(downloadedOllamaModels)
    ? downloadedOllamaModels.some(
        (ollamaModel) => ollamaModel === LOCAL_ONBOARDING_EMBEDDINGS_MODEL,
      )
    : false;

  const allDownloaded =
    hasDownloadedAutocompleteModel &&
    hasDownloadedChatModel &&
    hasDownloadedEmbeddingsModel;

  /**
   * The first time we detect that a chat model has been loaded,
   * we send an empty request to load it
   */
  useEffect(() => {
    if (!hasLoadedChatModel && hasDownloadedChatModel) {
      ideMessenger.post("llm/complete", {
        completionOptions: {},
        prompt: "",
        title: LOCAL_ONBOARDING_PROVIDER_TITLE,
      });

      setHasLoadedChatModel(true);
    }
  }, [downloadedOllamaModels, isOllamaConnected]);

  useEffect(() => {
    const fetchDownloadedModels = async () => {
      try {
        const result = await ideMessenger.request("llm/listModels", {
          title: LOCAL_ONBOARDING_PROVIDER_TITLE,
        });
        if (result.status === "success") {
          setDownloadedOllamaModels(result.content ?? []);
          setIsOllamaConnected(!!result.content);
        } else {
          throw new Error("Failed to fetch models");
        }
      } catch (error) {
        console.error("Error fetching models:", error);
        setIsOllamaConnected(false);
      }
    };

    const intervalId = setInterval(
      fetchDownloadedModels,
      OLLAMA_CHECK_INTERVAL_MS,
    );

    void fetchDownloadedModels();

    return () => clearInterval(intervalId);
  }, []);

  const onClickSubmitOnboarding = () => {
    submitOnboarding();

    if (isDialog) {
      dispatch(setDialogMessage(undefined));
      dispatch(setShowDialog(false));
    }

    void dispatch(
      updateSelectedModelByRole({
        selectedProfile,
        role: "chat",
        modelTitle: LOCAL_ONBOARDING_CHAT_TITLE,
      }),
    );
  };

  const onClickSkip = () => {
    submitOnboarding();

    ideMessenger.post("config/openProfile", {
      profileId: undefined,
    });

    if (isDialog) {
      dispatch(setDialogMessage(undefined));
      dispatch(setShowDialog(false));
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mt-3 flex flex-col gap-1 px-2">
          <div className="flex flex-col">
            <p className="mb-0 text-base font-bold leading-tight">
              Install Ollama
            </p>
            <OllamaStatus isOllamaConnected={isOllamaConnected} />
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

          <OllamaModelDownload
            title="Download Embeddings model"
            modelName={LOCAL_ONBOARDING_EMBEDDINGS_MODEL}
            hasDownloaded={hasDownloadedEmbeddingsModel}
          />

          <div className="mt-4 w-full">
            <Button
              onClick={onClickSubmitOnboarding}
              className="w-full"
              disabled={!allDownloaded}
            >
              Connect
            </Button>
            <div className="w-full text-center">
              <span
                className="text-description-muted cursor-pointer underline"
                onClick={onClickSkip}
              >
                Skip and configure manually
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
