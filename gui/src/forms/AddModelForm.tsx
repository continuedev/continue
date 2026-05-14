import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useContext, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Input, StyledActionButton } from "../components";
import Alert from "../components/gui/Alert";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { ModelProviderTags } from "../components/modelSelection/utils";
import { useAuth } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import {
  fetchProviderModels,
  initializeDynamicModels,
} from "../pages/AddNewModel/configs/fetchProviderModels";
import { DisplayInfo, ModelPackage } from "../pages/AddNewModel/configs/models";
import {
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";

interface AddModelFormProps {
  onDone: () => void;
  hideFreeTrialLimitMessage?: boolean;
}

const MODEL_PROVIDERS_URL =
  "https://docs.continue.dev/customize/model-providers";
const CODESTRAL_URL = "https://console.mistral.ai/codestral";
const CONTINUE_SETUP_URL = "https://docs.continue.dev/setup/overview";

export function AddModelForm({
  onDone,
  hideFreeTrialLimitMessage,
}: AddModelFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo>(
    providers["openai"]!,
  );
  const { selectedProfile } = useAuth();
  const [selectedModel, setSelectedModel] = useState(
    selectedProvider.packages[0],
  );
  const formMethods = useForm();
  const ideMessenger = useContext(IdeMessengerContext);

  const [fetchedModelsList, setFetchedModelsList] = useState<ModelPackage[]>(
    [],
  );
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  useEffect(() => {
    void initializeDynamicModels(ideMessenger);
  }, []);

  useEffect(() => {
    setFetchedModelsList([]);
  }, [selectedProvider]);

  const handleFetchModels = useCallback(async () => {
    const apiKey = formMethods.watch("apiKey");
    const apiBase = formMethods.watch("apiBase");
    if (!apiKey) return;

    const providerAtFetchTime = selectedProvider.provider;
    setIsFetchingModels(true);
    try {
      const models = await fetchProviderModels(
        ideMessenger,
        providerAtFetchTime,
        apiKey,
        apiBase,
      );
      setFetchedModelsList((prev) =>
        selectedProvider.provider === providerAtFetchTime ? models : prev,
      );
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsFetchingModels(false);
    }
  }, [ideMessenger, selectedProvider, formMethods]);

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

    const required = selectedProvider.collectInputFor
      ?.filter((input) => input.required)
      .map((input) => {
        const value = formMethods.watch(input.key);
        return value;
      });

    return !required?.every((value) => value !== undefined && value.length > 0);
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
    const apiKey = formMethods.watch("apiKey");
    const hasValidApiKey = apiKey !== undefined && apiKey !== "";

    const reqInputFields: Record<string, any> = {};
    for (let input of selectedProvider.collectInputFor ?? []) {
      reqInputFields[input.key] = formMethods.watch(input.key);
    }

    const model = {
      ...selectedProvider.params,
      ...selectedModel.params,
      ...reqInputFields,
      provider: selectedProvider.provider,
      title: selectedModel.title,
      ...(hasValidApiKey ? { apiKey } : {}),
    };

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
              <span className="text-description-muted mt-1 block text-xs">
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
                  title="Use entered API key to fetch available models"
                  className={`cursor-pointer border-none bg-transparent p-0 ${
                    apiKeyValue &&
                    apiKeyValue.length > 0 &&
                    selectedProvider.provider !== "ollama" &&
                    selectedProvider.provider !== "openrouter"
                      ? `text-description-muted hover:text-foreground`
                      : "invisible"
                  }`}
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                >
                  <ArrowPathIcon
                    className={`h-3.5 w-3.5 ${isFetchingModels ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <ModelSelectionListbox
                selectedProvider={selectedModel}
                setSelectedProvider={(val: DisplayInfo) => {
                  const options =
                    Object.entries(providers).find(
                      ([, provider]) =>
                        provider?.title === selectedProvider.title,
                    )?.[1]?.packages ?? [];
                  const allOptions = [...options, ...fetchedModelsList];
                  const match = allOptions.find(
                    (option) => option.title === val.title,
                  );
                  if (match) {
                    setSelectedModel(match);
                  }
                }}
                topOptions={(() => {
                  const providerInfo = Object.entries(providers).find(
                    ([, provider]) =>
                      provider?.title === selectedProvider.title,
                  )?.[1];
                  return (
                    providerInfo?.popularPackages ?? providerInfo?.packages
                  );
                })()}
                otherOptions={(() => {
                  const providerInfo = Object.entries(providers).find(
                    ([, provider]) =>
                      provider?.title === selectedProvider.title,
                  )?.[1];
                  const staticOther = providerInfo?.popularPackages
                    ? providerInfo.packages.filter(
                        (p) =>
                          !new Set(
                            providerInfo.popularPackages!.map((pp) => pp.title),
                          ).has(p.title),
                      )
                    : undefined;
                  // Merge dynamically fetched models (deduplicated)
                  if (fetchedModelsList.length > 0) {
                    const existingTitles = new Set(
                      (providerInfo?.packages ?? []).map((p) => p.title),
                    );
                    const newModels = fetchedModelsList.filter(
                      (m) => !existingTitles.has(m.title),
                    );
                    return [...(staticOther ?? []), ...newModels];
                  }
                  return staticOther;
                })()}
                otherOptionsLabel="Additional models"
              />
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
                      apiKeyWarning ? "border-warning w-full" : "w-full"
                    }
                    type="password"
                    placeholder={`Enter your ${selectedProvider.title} API key`}
                    {...formMethods.register("apiKey")}
                  />
                  {apiKeyWarning && (
                    <span className="text-warning mt-1 block text-xs">
                      {apiKeyWarning}
                    </span>
                  )}
                  <span className="text-description-muted mt-1 block text-xs">
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

            {selectedProvider.collectInputFor &&
              selectedProvider.collectInputFor
                .filter(
                  (field) =>
                    !Object.values(completionParamsInputs).some(
                      (input) => input.key === field.key,
                    ) &&
                    field.required &&
                    field.key !== "apiKey",
                )
                .map((field) => (
                  <div key={field.key}>
                    <>
                      <label className="mb-1 block text-sm font-medium">
                        {field.label}
                      </label>
                      <Input
                        id={field.key}
                        className="w-full"
                        defaultValue={field.defaultValue}
                        placeholder={`${field.placeholder}`}
                        {...formMethods.register(field.key)}
                      />
                    </>
                  </div>
                ))}
          </div>

          <div className="mt-4 w-full">
            <Button type="submit" className="w-full" disabled={isDisabled()}>
              Connect
            </Button>

            <span className="text-description-muted block w-full text-center text-xs">
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
