import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { models } from "../../../pages/AddNewModel/configs/models";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { setDefaultModel } from "../../../redux/slices/stateSlice";
import { OnboardingTab } from "../tabs/types";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Button, Input, InputSubtext, lightGray } from "../..";
import SubmitButtonSubtext from "./SubmitButtonSubtext";

const { anthropic: chatProvider, mistral: autocompleteProvider } = providers;
const { claude35Sonnet: chatModel, codestral: autocompleteModel } = models;

interface BestExperienceConfigFormProps {
  onComplete: OnboardingTab["onComplete"];
}

function BestExperienceConfigForm({
  onComplete,
}: BestExperienceConfigFormProps) {
  const dispatch = useDispatch();

  const ideMessenger = useContext(IdeMessengerContext);

  const [autocompleteApiKey, setAutocompleteApiKey] = useState("");
  const [chatApiKey, setChatApiKey] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    const chatModelConfig = {
      model: chatModel.params.model,
      provider: chatProvider.provider,
      apiKey: chatApiKey,
      title: chatModel.params.title,
    };

    const autocompleteModelConfig = {
      title: autocompleteModel.params.title,
      provider: autocompleteProvider.provider,
      model: autocompleteModel.params.model,
      apiKey: autocompleteApiKey,
    };

    ideMessenger.post("config/addModel", { model: chatModelConfig });
    dispatch(setDefaultModel({ title: chatModelConfig.title, force: true }));

    if (!!autocompleteApiKey) {
      await ideMessenger.request("addAutocompleteModel", {
        model: autocompleteModelConfig,
      });
    }

    onComplete();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col">
        <div>
          <p className="text-lg font-bold leading-tight mb-2 flex flex-row justify-between gap-4 mb-2">
            Chat model
            <span
              className="flex items-center text-xs font-semibold"
              style={{ color: lightGray }}
            >
              <CubeIcon className="w-4 h-4 mr-1 flex-shrink-0 " />
              <span className="italic">{chatModel.title}&nbsp;</span>
              <span>by Anthropic</span>
            </span>
          </p>

          <div className="flex flex-col pb-4 w-full">
            <Input
              placeholder="Enter your Anthropic API Key"
              value={chatApiKey}
              onChange={(e) => setChatApiKey(e.target.value)}
            />
            <InputSubtext>
              <a
                href={chatProvider.apiKeyUrl}
                target="_blank"
                className="text-inherit underline cursor-pointer hover:text-inherit"
              >
                Click here
              </a>{" "}
              to create an Anthropic API key
            </InputSubtext>
          </div>
        </div>

        <div>
          <p className="text-lg font-bold leading-tight mb-2 flex flex-row justify-between gap-4 mb-2">
            Autocomplete model
            <span
              className="flex items-center font-semibold"
              style={{ color: lightGray }}
            >
              <CubeIcon className="w-4 h-4 mr-1 flex-shrink-0" />
              <span className="text-xs">
                <span className="italic">{autocompleteModel.title}&nbsp;</span>
                <span>by Mistral</span>
              </span>
            </span>
          </p>

          <div className="flex flex-col pb-4 w-full">
            <Input
              placeholder="Enter your Mistral API Key"
              value={autocompleteApiKey}
              onChange={(e) => setAutocompleteApiKey(e.target.value)}
            />
            <InputSubtext>
              <a
                href={autocompleteProvider.apiKeyUrl}
                target="_blank"
                className="text-inherit underline cursor-pointer hover:text-inherit"
              >
                Click here
              </a>{" "}
              to create a Mistral API key
            </InputSubtext>
          </div>
        </div>

        <div className="mt-2 w-full">
          <Button className="w-full" type="submit" disabled={!chatApiKey}>
            Connect
          </Button>
          <SubmitButtonSubtext />
        </div>
      </div>
    </form>
  );
}
export default BestExperienceConfigForm;
