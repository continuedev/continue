import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button, Input, lightGray } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { models } from "../../../pages/AddNewModel/configs/models";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { setDefaultModel } from "../../../redux/slices/stateSlice";
import { OnboardingTab } from "../tabs/types";

const HelperText = styled.p`
  font-size: 0.8rem;
  color: ${lightGray};
  margin-top: 0.25rem;
`;

const { anthropic: chatProvider, mistral: autocompleteProvider } = providers;
const { claude35Sonnet: chatModel, codestral: autocompleteModel } = models;

interface DefaultModelConfigFormProps {
  onComplete: OnboardingTab["onComplete"];
}

function DefaultModelConfigForm({ onComplete }: DefaultModelConfigFormProps) {
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
          <h3 className={``}>
            Chat model: <code>{chatModel.title}</code>
          </h3>

          <div className="flex flex-col items-start gap-3 sm:gap-6 sm:flex-row">
            <p className="leading-relaxed mt-0 flex-1">
              {chatModel.description}
            </p>
            <label className="block pb-4 w-full sm:flex-1">
              Anthropic API Key
              <Input
                className="w-full"
                placeholder="Enter your Anthropic API Key"
                value={chatApiKey}
                onChange={(e) => setChatApiKey(e.target.value)}
              />
              <HelperText>
                <a href={chatProvider.apiKeyUrl} target="_blank underline">
                  Click here
                </a>{" "}
                to create an Anthropic API key
              </HelperText>
            </label>
          </div>
        </div>

        <div>
          <div className="flex flex-col mb-4">
            <h3 className="mb-1">
              Autocomplete model: <code>{autocompleteModel.title}</code>
            </h3>
            <i>Optional</i>
          </div>
          <div className="flex flex-col  items-start gap-3 sm:gap-6 sm:flex-row">
            <p className="leading-relaxed mt-0 flex-1">
              {autocompleteModel.description}
            </p>
            <label className="block pb-4 w-full sm:flex-1">
              Mistral API Key
              <Input
                className="w-full"
                placeholder="Enter your Mistral API Key"
                value={autocompleteApiKey}
                onChange={(e) => setAutocompleteApiKey(e.target.value)}
              />
              <HelperText>
                <a href={autocompleteProvider.apiKeyUrl} target="_blank">
                  Click here
                </a>{" "}
                to create a Mistral API key
              </HelperText>
            </label>
          </div>
        </div>

        <div className="mt-4 w-full">
          <Button className="w-full" type="submit" disabled={!chatApiKey}>
            Submit
          </Button>
        </div>
      </div>
    </form>
  );
}

export default DefaultModelConfigForm;
