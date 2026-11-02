import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Input, StyledActionButton } from "../components";
import Alert from "../components/gui/Alert";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { ModelProviderTags } from "../components/modelSelection/utils";
import { useAuth } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import {
  fetchProviderModels,
  initializeDynamicModels,
} from "../pages/AddNewModel/configs/fetchProviderModels";
import { DisplayInfo, ModelPackage } from "../pages/AddNewModel/configs/models";
import {
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";
import type { BedrockModelOptionInfo } from "core/protocol/core";
import {
  areRequiredFieldsFilled,
  buildModelFromForm,
  getBedrockConnectionParams,
  getRenderableFields,
} from "./addModelFormUtils";
import {
  BedrockConnectionTester,
  listBedrockModels,
} from "./BedrockConnectionTester";
import { FormSelect } from "./FormSelect";
import { bedrockOptionsToPackages, computeModelLists } from "./modelListUtils";

interface AddModelFormProps {
  onDone: () => void;
}

const MODEL_PROVIDERS_URL =
  "https://docs.continue.dev/customize/model-providers";
const CODESTRAL_URL = "https://console.mistral.ai/codestral";
const CONTINUE_SETUP_URL = "https://docs.continue.dev/setup/overview";

const isBedrockProvider = (provider: string) =>
  provider === "bedrock" || provider === "bedrock-mantle";

export function AddModelForm({ onDone }: AddModelFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo>(
    providers["openai"]!,
  );
  const { selectedProfile } = useAuth();
  const [selectedModel, setSelectedModel] = useState(
    selectedProvider.packages[0],
  );
  const formMethods = useForm();
  // Subscribing to all values lets conditional fields (e.g. auth method) re-render.
  const formValues = formMethods.watch();
  const ideMessenger = useContext(IdeMessengerContext);

  // Models the provider reports for the entered credentials. Empty until a
  // connection test or refresh succeeds; then it replaces the curated list.
  const [liveModels, setLiveModels] = useState<ModelPackage[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const providerRef = useRef(selectedProvider.provider);
  providerRef.current = selectedProvider.provider;

  useEffect(() => {
    void initializeDynamicModels(ideMessenger);
  }, []);

  useEffect(() => {
    setLiveModels([]);
    setRefreshError(undefined);
  }, [selectedProvider]);

  const modelLists = computeModelLists(selectedProvider, liveModels);
  const isBedrock = isBedrockProvider(selectedProvider.provider);
  const bedrockConnection = isBedrock
    ? getBedrockConnectionParams(selectedProvider, selectedModel, formValues)
    : undefined;
  const canRefresh = isBedrock
    ? areRequiredFieldsFilled(selectedProvider, formValues)
    : !!formValues.apiKey &&
      selectedProvider.provider !== "ollama" &&
      selectedProvider.provider !== "openrouter";

  /** Show a freshly loaded live list, keeping the current pick when it is still offered. */
  function applyLiveModels(packages: ModelPackage[], forProvider: string) {
    if (providerRef.current !== forProvider) return;
    setLiveModels(packages);
    if (packages.length === 0) return;
    const lists = computeModelLists(selectedProvider, packages);
    const all = [...lists.top, ...(lists.other ?? [])];
    if (!all.some((m) => m.params.model === selectedModel.params.model)) {
      setSelectedModel(all[0]);
    }
  }

  const handleRefreshModels = useCallback(async () => {
    const providerAtFetchTime = selectedProvider.provider;
    setIsFetchingModels(true);
    setRefreshError(undefined);
    try {
      if (isBedrockProvider(providerAtFetchTime)) {
        const result = await listBedrockModels(
          ideMessenger,
          bedrockConnection ?? {},
        );
        if (!result.ok) {
          setRefreshError(result.error);
          return;
        }
        applyLiveModels(
          bedrockOptionsToPackages(
            result.models,
            providerAtFetchTime as "bedrock" | "bedrock-mantle",
          ),
          providerAtFetchTime,
        );
        return;
      }
      const models = await fetchProviderModels(
        ideMessenger,
        providerAtFetchTime,
        formMethods.getValues("apiKey"),
        formMethods.getValues("apiBase"),
      );
      if (models.length === 0) {
        setRefreshError("No models were returned. Check the API key.");
        return;
      }
      applyLiveModels(models, providerAtFetchTime);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setRefreshError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsFetchingModels(false);
    }
  }, [
    ideMessenger,
    selectedProvider,
    selectedModel,
    formMethods,
    bedrockConnection,
  ]);

  /** Picking from the list wins over a previously typed custom Bedrock model ID. */
  function onPickModel(val: DisplayInfo) {
    const match = [...modelLists.top, ...(modelLists.other ?? [])].find(
      (option) => option.title === val.title,
    );
    if (match) {
      setSelectedModel(match);
      if (isBedrock) {
        formMethods.setValue("model", "", { shouldDirty: true });
      }
    }
  }

  const popularProviderTitles = [
    providers["openai"]?.title || "",
    providers["anthropic"]?.title || "",
    providers["mistral"]?.title || "",
    providers["gemini"]?.title || "",
    providers["azure"]?.title || "",
    providers["ollama"]?.title || "",
    providers["openrouter"]?.title || "",
  ];

  const allProviders = Object.entries(providers)
    .filter(([key]) => !["openai-aiohttp"].includes(key))
    .map(([, provider]) => provider)
    .filter((provider) => !!provider)
    .map((provider) => provider!); // for type checking

  const popularProviders = allProviders
    .filter((provider) => popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const otherProviders = allProviders
    .filter((provider) => !popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const selectedProviderApiKeyUrl =
    selectedModel && selectedModel.params.model.startsWith("codestral")
      ? CODESTRAL_URL
      : selectedProvider.apiKeyUrl;

  function isDisabled() {
    if (selectedProvider.downloadUrl) {
      return false;
    }

    return !areRequiredFieldsFilled(selectedProvider, formValues);
  }

  useEffect(() => {
    setSelectedModel(selectedProvider.packages[0]);
    if (!selectedProvider.tags?.includes(ModelProviderTags.RequiresApiKey)) {
      formMethods.setValue("apiKey", "");
    }
  }, [selectedProvider]);

  const requiresSkPrefix =
    selectedProvider.provider === "openai" ||
    selectedProvider.provider === "anthropic";

  const apiKeyValue = formMethods.watch("apiKey");
  const apiKeyWarning =
    requiresSkPrefix &&
    apiKeyValue &&
    apiKeyValue.length > 0 &&
    !apiKeyValue.startsWith("sk-")
      ? "API key usually starts with sk-"
      : undefined;

  function onSubmit() {
    const model = buildModelFromForm(
      selectedProvider,
      selectedModel,
      formMethods.getValues(),
      {
        // Live Bedrock entries carry a descriptive title ("... (Bedrock)").
        title:
          isBedrock && modelLists.isLive
            ? selectedModel.params.title
            : undefined,
      },
    );

    ideMessenger.post("config/addModel", { model });

    ideMessenger.post("config/openProfile", {
      profileId: "local",
    });

    if (selectedProfile) {
      ideMessenger.post("config/updateSelectedModel", {
        profileId: selectedProfile.id,
        role: "chat",
        title: model.title,
      });
    }

    formMethods.setValue("apiKey", "");
    onDone();
  }

  function onClickDownloadProvider() {
    selectedProvider.downloadUrl &&
      ideMessenger.post("openUrl", selectedProvider.downloadUrl);
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-0 text-center text-2xl">Add Chat model</h1>

          <div className="my-8 flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium">Provider</label>
              <ModelSelectionListbox
                selectedProvider={selectedProvider}
                setSelectedProvider={(val: DisplayInfo) => {
                  const match = [...popularProviders, ...otherProviders].find(
                    (provider) => provider.title === val.title,
                  );
                  if (match) {
                    setSelectedProvider(match);
                  }
                }}
                topOptions={popularProviders}
                otherOptions={otherProviders}
                searchPlaceholder="Search providers..."
              />
              <span className="mt-1 block text-xs text-description-muted">
                Don't see your provider?{" "}
                <a
                  className="cursor-pointer text-inherit underline hover:text-inherit"
                  onClick={() =>
                    ideMessenger.post("openUrl", MODEL_PROVIDERS_URL)
                  }
                >
                  Click here
                </a>{" "}
                to view the full list
              </span>
            </div>

            {selectedProvider.downloadUrl && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Install provider
                </label>
                <StyledActionButton onClick={onClickDownloadProvider}>
                  <p className="text-sm underline">
                    {selectedProvider.downloadUrl}
                  </p>
                  <ArrowTopRightOnSquareIcon width={24} height={24} />
                </StyledActionButton>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Model</label>
                <button
                  type="button"
                  aria-label="Refresh model list"
                  title={
                    isBedrock
                      ? "Use the entered credentials to list the models available in this region"
                      : "Use the entered API key to list the models available to you"
                  }
                  className={`cursor-pointer border-none bg-transparent p-0 ${
                    canRefresh
                      ? `text-description-muted hover:text-foreground`
                      : "invisible"
                  }`}
                  onClick={handleRefreshModels}
                  disabled={isFetchingModels}
                >
                  <ArrowPathIcon
                    className={`h-3.5 w-3.5 ${isFetchingModels ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <ModelSelectionListbox
                selectedProvider={selectedModel}
                setSelectedProvider={onPickModel}
                topOptions={modelLists.top}
                topOptionsLabel={
                  modelLists.isLive ? "Latest available" : "Popular"
                }
                otherOptions={modelLists.other}
                otherOptionsLabel={
                  modelLists.isLive
                    ? "Other available models"
                    : "Additional models"
                }
              />
              {modelLists.isLive && (
                <span className="mt-1 block text-xs text-description-muted">
                  Showing {liveModels.length} model
                  {liveModels.length === 1 ? "" : "s"} available to your
                  account.
                </span>
              )}
              {refreshError && (
                <span className="mt-1 block whitespace-pre-wrap text-xs text-warning">
                  Couldn't refresh the model list: {refreshError}
                </span>
              )}
            </div>

            {selectedModel.params.model.startsWith("codestral") && (
              <div className="my-2">
                <Alert>
                  <p className="m-0 text-sm font-bold">Codestral API key</p>
                  <p className="m-0 mt-1">
                    Note that codestral requires a different API key from other
                    Mistral models
                  </p>
                </Alert>
              </div>
            )}

            {selectedProvider.apiKeyUrl && (
              <div>
                <>
                  <label className="mb-1 block text-sm font-medium">
                    API key
                  </label>
                  <Input
                    id="apiKey"
                    className={
                      apiKeyWarning ? "w-full border-warning" : "w-full"
                    }
                    type="password"
                    placeholder={`Enter your ${selectedProvider.title} API key`}
                    {...formMethods.register("apiKey")}
                  />
                  {apiKeyWarning && (
                    <span className="mt-1 block text-xs text-warning">
                      {apiKeyWarning}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-description-muted">
                    <a
                      className="cursor-pointer text-inherit underline hover:text-inherit hover:brightness-125"
                      onClick={() => {
                        if (selectedProviderApiKeyUrl) {
                          ideMessenger.post(
                            "openUrl",
                            selectedProviderApiKeyUrl,
                          );
                        }
                      }}
                    >
                      Click here
                    </a>{" "}
                    to create a {selectedProvider.title} API key
                  </span>
                </>
              </div>
            )}

            {getRenderableFields(selectedProvider, formValues).map((field) => (
              <div key={`${selectedProvider.provider}-${field.key}`}>
                <label
                  className="mb-1 block text-sm font-medium"
                  htmlFor={field.key}
                >
                  {field.label}
                </label>
                {field.inputType === "select" ? (
                  <FormSelect
                    id={field.key}
                    defaultValue={field.defaultValue}
                    {...formMethods.register(field.key)}
                  >
                    {(
                      field.choices ??
                      (field.options ?? []).map((o) => ({ value: o, label: o }))
                    ).map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </FormSelect>
                ) : (
                  <Input
                    id={field.key}
                    className="w-full"
                    type={field.inputType === "password" ? "password" : "text"}
                    defaultValue={field.defaultValue}
                    placeholder={`${field.placeholder ?? ""}`}
                    {...formMethods.register(field.key)}
                  />
                )}
                {field.description && (
                  <span className="mt-1 block text-xs text-description-muted">
                    {field.description}
                  </span>
                )}
              </div>
            ))}

            {isBedrock && (
              <BedrockConnectionTester
                connection={bedrockConnection ?? {}}
                model={formValues.model || selectedModel.params.model}
                canTest={areRequiredFieldsFilled(selectedProvider, formValues)}
                onModelsLoaded={(models) => {
                  setRefreshError(undefined);
                  const forProvider = selectedProvider.provider;
                  if (!models) {
                    setLiveModels([]);
                    return;
                  }
                  applyLiveModels(
                    bedrockOptionsToPackages(
                      models,
                      forProvider as "bedrock" | "bedrock-mantle",
                    ),
                    forProvider,
                  );
                }}
              />
            )}
          </div>

          <div className="mt-4 w-full">
            <Button type="submit" className="w-full" disabled={isDisabled()}>
              Connect
            </Button>

            <span className="block w-full text-center text-xs text-description-muted">
              This will update your{" "}
              <span
                className="cursor-pointer underline hover:brightness-125"
                onClick={() =>
                  ideMessenger.post("config/openProfile", {
                    profileId: undefined,
                  })
                }
              >
                config file
              </span>
            </span>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default AddModelForm;
