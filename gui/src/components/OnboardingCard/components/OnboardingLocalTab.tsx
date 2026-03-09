import {
  DEFAULT_LOCAL_ONBOARDING_PROVIDER,
  getLocalOnboardingConfig,
  getLocalOnboardingPrimaryModelTitle,
  type LocalOnboardingProvider,
} from "core/config/onboarding";
import { OnboardingModes } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { Button } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { providers } from "../../../pages/AddNewModel/configs/providers";
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
  const [localProvider, setLocalProvider] = useState<LocalOnboardingProvider>(
    DEFAULT_LOCAL_ONBOARDING_PROVIDER,
  );
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>(
    [],
  );
  const { selectedProfile } = useAuth();

  const [isProviderConnected, setIsProviderConnected] = useState(false);

  const onboardingConfig = getLocalOnboardingConfig(localProvider);
  const isOllamaProvider = localProvider === "ollama";
  const providerDownloadUrl = isOllamaProvider
    ? providers.ollama?.downloadUrl
    : providers.lmstudio?.downloadUrl;

  const hasDownloadedChatModel = Array.isArray(availableLocalModels)
    ? availableLocalModels.some(
        (ollamaModel) => ollamaModel === onboardingConfig.chatModel,
      )
    : false;

  const hasDownloadedAutocompleteModel = Array.isArray(availableLocalModels)
    ? availableLocalModels.some(
        (ollamaModel) => ollamaModel === onboardingConfig.autocompleteModel,
      )
    : false;

  const hasDownloadedEmbeddingsModel = Array.isArray(availableLocalModels)
    ? availableLocalModels.some(
        (ollamaModel) => ollamaModel === onboardingConfig.embeddingsModel,
      )
    : false;

  const allDownloaded = isOllamaProvider
    ? hasDownloadedAutocompleteModel &&
      hasDownloadedChatModel &&
      hasDownloadedEmbeddingsModel
    : availableLocalModels.length > 0;

  /**
   * The first time we detect that a chat model has been loaded,
   * we send an empty request to load it
   */
  useEffect(() => {
    if (isOllamaProvider && !hasLoadedChatModel && hasDownloadedChatModel) {
      ideMessenger.post("llm/complete", {
        completionOptions: {},
        prompt: "",
        title: onboardingConfig.providerTitle,
      });

      setHasLoadedChatModel(true);
    }
  }, [
    availableLocalModels,
    hasDownloadedChatModel,
    hasLoadedChatModel,
    ideMessenger,
    isOllamaProvider,
    onboardingConfig.providerTitle,
  ]);

  useEffect(() => {
    setHasLoadedChatModel(false);
  }, [localProvider]);

  useEffect(() => {
    const fetchDownloadedModels = async () => {
      try {
        const result = await ideMessenger.request("llm/listModels", {
          title: onboardingConfig.providerTitle,
        });
        if (result.status === "success") {
          const models = result.content ?? [];
          setAvailableLocalModels(models);
          setIsProviderConnected(Array.isArray(result.content));
        } else {
          throw new Error("Failed to fetch models");
        }
      } catch (error) {
        console.error("Error fetching models:", error);
        setAvailableLocalModels([]);
        setIsProviderConnected(false);
      }
    };

    const intervalId = setInterval(
      fetchDownloadedModels,
      OLLAMA_CHECK_INTERVAL_MS,
    );

    void fetchDownloadedModels();

    return () => clearInterval(intervalId);
  }, [ideMessenger, onboardingConfig.providerTitle]);

  const onClickSubmitOnboarding = () => {
    submitOnboarding(localProvider, undefined, availableLocalModels);

    if (isDialog) {
      dispatch(setDialogMessage(undefined));
      dispatch(setShowDialog(false));
    }

    void dispatch(
      updateSelectedModelByRole({
        selectedProfile,
        role: "chat",
        modelTitle: getLocalOnboardingPrimaryModelTitle(
          localProvider,
          availableLocalModels,
        ),
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
          <div className="mb-3 flex gap-2">
            {(["ollama", "lmstudio"] as LocalOnboardingProvider[]).map(
              (providerKey) => {
                const isSelected = providerKey === localProvider;
                const providerTitle =
                  getLocalOnboardingConfig(providerKey).providerTitle;

                return (
                  <button
                    key={providerKey}
                    type="button"
                    onClick={() => setLocalProvider(providerKey)}
                    className={`flex-1 cursor-pointer rounded border px-3 py-2 text-sm transition-colors ${isSelected ? "border-border-focus bg-input text-foreground" : "border-border bg-transparent text-description hover:bg-input"}`}
                  >
                    {providerTitle}
                  </button>
                );
              },
            )}
          </div>

          <div className="flex flex-col">
            <p className="mb-0 text-base font-bold leading-tight text-foreground">
              {isOllamaProvider ? "Install Ollama" : "Install LM Studio"}
            </p>
            {isOllamaProvider ? (
              <OllamaStatus isOllamaConnected={isProviderConnected} />
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (providerDownloadUrl) {
                      ideMessenger.post("openUrl", providerDownloadUrl);
                    }
                  }}
                  className="bg-vsc-input-background text-left"
                >
                  <span className="text-link underline">
                    {providerDownloadUrl}
                  </span>
                </button>
                <div className="rounded border border-border bg-input px-3 py-2 text-sm">
                  {isProviderConnected ? (
                    <span>
                      Connected to LM Studio at{" "}
                      <code>http://localhost:1234/v1</code>
                    </span>
                  ) : (
                    <span>
                      Start the LM Studio local inference server at{" "}
                      <code>http://localhost:1234/v1</code>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {isOllamaProvider ? (
            <>
              <OllamaModelDownload
                title="Download Chat model"
                modelName={onboardingConfig.chatModel}
                hasDownloaded={hasDownloadedChatModel}
              />

              <OllamaModelDownload
                title="Download Autocomplete model"
                modelName={onboardingConfig.autocompleteModel!}
                hasDownloaded={hasDownloadedAutocompleteModel}
              />

              <OllamaModelDownload
                title="Download Embeddings model"
                modelName={onboardingConfig.embeddingsModel!}
                hasDownloaded={hasDownloadedEmbeddingsModel}
              />
            </>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <p className="mb-0 text-base font-semibold text-foreground">
                Available LM Studio models
              </p>
              <div className="rounded border border-border bg-input px-3 py-2">
                {availableLocalModels.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {availableLocalModels.slice(0, 4).map((modelName) => (
                      <code key={modelName} className="text-xs">
                        {modelName}
                      </code>
                    ))}
                    {availableLocalModels.length > 4 && (
                      <span className="text-xs text-description-muted">
                        +{availableLocalModels.length - 4} more
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-description-muted">
                    No models detected yet. Load a model in LM Studio and start
                    the local server.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 w-full">
            <Button
              onClick={onClickSubmitOnboarding}
              className="w-full cursor-pointer hover:opacity-90"
              disabled={!allDownloaded}
            >
              Connect
            </Button>
            <div className="w-full text-center">
              <span
                className="cursor-pointer text-description-muted underline"
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
