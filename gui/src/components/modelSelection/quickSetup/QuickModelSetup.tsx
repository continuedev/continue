import { useContext, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { Button, Input, SecondaryButton } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import {
  ProviderInfo,
  providers,
} from "../../../pages/AddNewModel/configs/providers";
import { setDefaultModel } from "../../../redux/slices/stateSlice";
import {
  FREE_TRIAL_LIMIT_REQUESTS,
  hasPassedFTL,
} from "../../../util/freeTrial";
import QuickSetupListBox from "./QuickSetupListBox";

interface QuickModelSetupProps {
  onDone: () => void;
  hideFreeTrialLimitMessage?: boolean;
}

function QuickModelSetup(props: QuickModelSetupProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo>(
    providers["openai"]!,
  );
  const [selectedModel, setSelectedModel] = useState(
    selectedProvider.packages[0],
  );
  const formMethods = useForm();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    setSelectedModel(selectedProvider.packages[0]);
  }, [selectedProvider]);

  const [hasAddedModel, setHasAddedModel] = useState(false);

  return (
    <FormProvider {...formMethods}>
      <div className="p-4">
        {!props.hideFreeTrialLimitMessage && hasPassedFTL() && (
          <p className="text-sm text-gray-500">
            You've reached the free trial limit of {FREE_TRIAL_LIMIT_REQUESTS}{" "}
            free inputs. To keep using Continue, you can either use your own API
            key, or use a local LLM. To read more about the options, see our{" "}
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

        <h4>1. Select a provider</h4>
        <QuickSetupListBox
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          options={Object.entries(providers)
            .filter(([key]) => !["freetrial", "openai-aiohttp"].includes(key))
            .map(([, provider]) => provider)}
        ></QuickSetupListBox>

        <h4>2. Select a model</h4>
        <QuickSetupListBox
          selectedProvider={selectedModel}
          setSelectedProvider={setSelectedModel}
          options={
            Object.entries(providers).find(
              ([, provider]) => provider.title === selectedProvider.title,
            )?.[1].packages
          }
        ></QuickSetupListBox>

        {selectedProvider.apiKeyUrl && (
          <>
            <h4>3. Paste your API key</h4>
            {selectedModel.params.model.startsWith("codestral") && (
              <i>
                Note: Codestral requires a different API key from other Mistral
                models
              </i>
            )}
            <SecondaryButton
              className="w-full border-2 border-solid"
              onClick={() => {
                let apiKeyUrl = selectedProvider.apiKeyUrl;
                if (selectedModel.params.model.startsWith("codestral")) {
                  apiKeyUrl = "https://console.mistral.ai/codestral";
                }
                if (apiKeyUrl) {
                  ideMessenger.post("openUrl", apiKeyUrl);
                }
              }}
            >
              Get API Key
            </SecondaryButton>
            <Input
              id="apiKey"
              className="w-full"
              placeholder="Enter API Key"
              {...formMethods.register("apiKey", { required: true })}
            />
          </>
        )}
        {selectedProvider.downloadUrl && (
          <>
            <h4>3. Download {selectedProvider.title}</h4>
            <SecondaryButton
              className="w-full border-2 border-solid"
              onClick={() => {
                selectedProvider.downloadUrl &&
                  ideMessenger.post("openUrl", selectedProvider.downloadUrl);
              }}
            >
              Download {selectedProvider.title}
            </SecondaryButton>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Button
            disabled={
              selectedProvider.apiKeyUrl && !formMethods.watch("apiKey")
            }
            onClick={() => {
              const model = {
                ...selectedProvider.params,
                ...selectedModel.params,
                provider: selectedProvider.provider,
                apiKey: formMethods.watch("apiKey"),
                title: selectedModel.title,
              };
              ideMessenger.post("config/addModel", { model });
              dispatch(setDefaultModel({ title: model.title, force: true }));
              setHasAddedModel(true);
            }}
            className="w-full"
          >
            Add Model
          </Button>
          <Button
            onClick={props.onDone}
            className="w-full"
            disabled={!hasAddedModel}
          >
            Done
          </Button>
        </div>
      </div>
    </FormProvider>
  );
}

export default QuickModelSetup;
