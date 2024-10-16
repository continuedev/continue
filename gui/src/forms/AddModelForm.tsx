import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { Button, Input, InputSubtext, StyledActionButton } from "../components";
import AddModelButtonSubtext from "../components/AddModelButtonSubtext";
import Alert from "../components/gui/Alert";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { IdeMessengerContext } from "../context/IdeMessenger";
import {
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";
import { setDefaultModel } from "../redux/slices/stateSlice";
import { FREE_TRIAL_LIMIT_REQUESTS, hasPassedFTL } from "../util/freeTrial";
import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import { NotDiamondSubtext } from "../components/notdiamond/NotDiamondSubtext";
import { ProviderModelMap } from "../constants/notdiamond-providers";
import { BaseApiKey } from "../components/notdiamond/BaseApiKey";
import { ApiKeysInputs } from "../components/notdiamond/ApiKeysInputs";

interface QuickModelSetupProps {
  onDone: () => void;
  hideFreeTrialLimitMessage?: boolean;
}

function AddModelForm({
  onDone,
  hideFreeTrialLimitMessage,
}: QuickModelSetupProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo>(
    providers["openai"]!,
  );

  const [selectedModel, setSelectedModel] = useState(
    selectedProvider.packages[0],
  );

  const formMethods = useForm();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const selectedProviderApiKeyUrl = selectedModel.params.model.startsWith(
    "codestral",
  )
    ? "https://console.mistral.ai/codestral"
    : selectedProvider.apiKeyUrl;

  function isDisabled() {
    if (
      selectedProvider.downloadUrl ||
      selectedProvider.provider === "free-trial"
    ) {
      return false;
    }

    const required = selectedProvider.collectInputFor
      .filter((input) => input.required)
      .map((input) => {
        const value = formMethods.watch(input.key);
        return value;
      });

    return !required.every((value) => value !== undefined && value.length > 0);
  }

  useEffect(() => {
    setSelectedModel(selectedProvider.packages[0]);
  }, [selectedProvider]);

  function onSubmit() {
    const apiKey = formMethods.watch("apiKey");
    const hasValidApiKey = apiKey !== undefined && apiKey !== "";
    const reqInputFields = {};
    for (let input of selectedProvider.collectInputFor) {
      reqInputFields[input.key] = formMethods.watch(input.key);
    }

    const model = {
      ...selectedProvider.params,
      ...selectedModel.params,
      ...reqInputFields,
      provider: selectedProvider.provider,
      title: selectedModel.title,
      ...(hasValidApiKey ? { apiKey } : {}),
      ...(selectedProvider.provider === "notdiamond"
        ? {
            notDiamondProviders: {
              ...(formMethods.watch("providerApiKeys.openai") && {
                openai: {
                  apiKey: formMethods.watch("providerApiKeys.openai"),
                  models: ProviderModelMap['openai'] || []
                }
              }),
              ...(formMethods.watch("providerApiKeys.anthropic") && {
                anthropic: {
                  apiKey: formMethods.watch("providerApiKeys.anthropic"),
                  models: ProviderModelMap['anthropic'] || []
                }
              }),
              ...(formMethods.watch("providerApiKeys.google") && {
                google: {
                  apiKey: formMethods.watch("providerApiKeys.google"),
                  models: ProviderModelMap['google'] || []
                }
              }),
              ...(formMethods.watch("providerApiKeys.mistral") && {
                mistral: {
                  apiKey: formMethods.watch("providerApiKeys.mistral"),
                  models: ProviderModelMap['mistral'] || []
                }
              }),
              ...(formMethods.watch("providerApiKeys.perplexity") && {
                perplexity: {
                  apiKey: formMethods.watch("providerApiKeys.perplexity"),
                  models: ProviderModelMap['perplexity'] || []
                }
              }),
            },
          }
        : {}),
    };

    ideMessenger.post("config/addModel", { model });
    ideMessenger.post("openConfigJson", undefined);

    dispatch(setDefaultModel({ title: model.title, force: true }));

    onDone();
  }

  function onClickDownloadProvider() {
    selectedProvider.downloadUrl &&
      ideMessenger.post("openUrl", selectedProvider.downloadUrl);
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="p-6 max-w-md mx-auto">
          <h1 className="text-center mb-0">Add Chat model</h1>
          {!hideFreeTrialLimitMessage && hasPassedFTL() && (
            <p className="text-sm text-gray-500">
              You've reached the free trial limit of {FREE_TRIAL_LIMIT_REQUESTS}{" "}
              free inputs. To keep using Continue, you can either use your own
              API key, or use a local LLM. To read more about the options, see
              our{" "}
              <a
                href="https://docs.continue.dev/setup/overview"
                target="_blank"
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://docs.continue.dev/setup/overview",
                  )
                }
              >
                documentation
              </a>
              .
            </p>
          )}

          <div className="flex flex-col gap-6 my-8">
            <div>
              <label className="block text-sm font-medium">Provider</label>
              <ModelSelectionListbox
                selectedProvider={selectedProvider}
                setSelectedProvider={setSelectedProvider}
                options={Object.entries(providers)
                  .filter(
                    ([key]) => !["freetrial", "openai-aiohttp"].includes(key),
                  )
                  .map(([, provider]) => provider)}
              ></ModelSelectionListbox>
              <InputSubtext className="mb-0">
                Don't see your provider?{" "}
                <a
                  href="https://docs.continue.dev/customize/model-providers"
                  target="_blank"
                  className="text-inherit underline cursor-pointer hover:text-inherit"
                >
                  Click here
                </a>{" "}
                to view the full list
              </InputSubtext>
            </div>

            {selectedProvider.downloadUrl && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Install provider
                </label>

                <StyledActionButton onClick={onClickDownloadProvider}>
                  <p className="underline text-sm">
                    {selectedProvider.downloadUrl}
                  </p>
                  <ArrowTopRightOnSquareIcon width={24} height={24} />
                </StyledActionButton>
              </div>
            )}
            {selectedProvider.provider !== "notdiamond" && selectedModel && (
              <div>
                <label className="block text-sm font-medium">Model</label>
                <ModelSelectionListbox
                  selectedProvider={selectedModel}
                  setSelectedProvider={setSelectedModel}
                  options={
                    Object.entries(providers).find(
                      ([, provider]) =>
                        provider.title === selectedProvider.title,
                    )?.[1].packages
                  }
                ></ModelSelectionListbox>
              </div>
            )}

            {selectedProvider.provider === "notdiamond" && (
              <NotDiamondSubtext />
            )}
            {selectedModel?.params.model.startsWith("codestral") && (
              <div className="my-2">
                <Alert>
                  <p className="font-bold text-sm m-0">Codestral API key</p>
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
                  <label className="block text-sm font-medium mb-1">
                    API key
                  </label>
                  <Input
                    id="apiKey"
                    className="w-full"
                    placeholder={`Enter your ${selectedProvider.title} API key`}
                    {...formMethods.register("apiKey")}
                  />
                  <InputSubtext className="mb-0">
                    <a
                      href={selectedProviderApiKeyUrl}
                      target="_blank"
                      className="text-inherit underline cursor-pointer hover:text-inherit"
                    >
                      Click here
                    </a>{" "}
                    to create a {selectedProvider.title} API key
                  </InputSubtext>
                </>
              </div>
            )}

            {selectedProvider.provider === "notdiamond" && <ApiKeysInputs />}

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
                  <div>
                    <>
                      <label className="block text-sm font-medium mb-1">
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
            <AddModelButtonSubtext />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default AddModelForm;
