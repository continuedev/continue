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

    const apiKey = formMethods.watch("apiKey");
    return typeof apiKey === "undefined" || apiKey.length === 0;
  }

  useEffect(() => {
    setSelectedModel(selectedProvider.packages[0]);
  }, [selectedProvider]);

  function onSubmit() {
    const apiKey = formMethods.watch("apiKey");
    const hasValidApiKey = apiKey !== undefined && apiKey !== "";

    const model = {
      ...selectedProvider.params,
      ...selectedModel.params,
      provider: selectedProvider.provider,
      title: selectedModel.title,
      ...(hasValidApiKey ? { apiKey } : {}),
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

            <div>
              <label className="block text-sm font-medium">Model</label>
              <ModelSelectionListbox
                selectedProvider={selectedModel}
                setSelectedProvider={setSelectedModel}
                options={
                  Object.entries(providers).find(
                    ([, provider]) => provider.title === selectedProvider.title,
                  )?.[1].packages
                }
              ></ModelSelectionListbox>
            </div>

            {selectedModel.params.model.startsWith("codestral") && (
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
                  <label className="block text-sm font-medium">API key</label>
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
