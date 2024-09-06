import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Input, lightGray } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import { models } from "../../pages/AddNewModel/configs/models";
import { providers } from "../../pages/AddNewModel/configs/providers";
import { useCompleteOnboarding } from "../../pages/onboarding/utils";
import { CheckMarkHeader } from "./CheckMarkHeader";

const HelperText = styled.p`
  font-size: 0.8rem;
  color: ${lightGray};
  margin-top: 0.25rem;
`;

function DefaultModelConfigForm() {
  const dispatch = useDispatch();

  const ideMessenger = useContext(IdeMessengerContext);

  const [mistralApiKey, setMistralApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");

  const { completeOnboarding } = useCompleteOnboarding();

  const isFormComplete = !!mistralApiKey && !!anthropicApiKey;

  const { anthropic, mistral } = providers;
  const { claude35Sonnet: chatModel, codestral: autocompleteModel } = models;

  async function handleSubmit(e) {
    e.preventDefault();

    const chatModelConfig = {
      model: chatModel.params.model,
      provider: anthropic.provider,
      apiKey: anthropicApiKey,
      title: chatModel.params.title,
    };

    const autocompleteModelConfig = {
      title: autocompleteModel.params.title,
      provider: mistral.provider,
      model: autocompleteModel.params.model,
      apiKey: mistralApiKey,
    };

    ideMessenger.post("config/addModel", { model: chatModelConfig });

    dispatch(setDefaultModel({ title: chatModelConfig.title, force: true }));

    await ideMessenger.request("addAutocompleteModel", {
      model: autocompleteModelConfig,
    });

    ideMessenger.post("showTutorial", undefined);

    completeOnboarding();
  }

  return (
    <form onSubmit={handleSubmit} className="pt-8">
      <div className="flex flex-col gap-2">
        <div>
          <CheckMarkHeader isComplete={true}>
            {`Chat - ${chatModel.title}`}
          </CheckMarkHeader>
          <div className="flex items-start gap-6">
            <p className="leading-relaxed mt-0 flex-1">
              {chatModel.description}
            </p>
            <label className="block pb-4 flex-1">
              Anthropic API Key
              <Input
                className="w-full"
                placeholder="Enter your Anthropic API Key"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
              />
              <HelperText>
                <a href={anthropic.apiKeyUrl} target="_blank underline">
                  Click here
                </a>{" "}
                to create an Anthropic API key
              </HelperText>
            </label>
          </div>
        </div>

        <div>
          <CheckMarkHeader isComplete={true}>
            {`Autocomplete model - ${autocompleteModel.title}`}
          </CheckMarkHeader>
          <div className="flex items-start gap-6">
            <p className="leading-relaxed mt-0 flex-1">
              {autocompleteModel.description}
            </p>
            <label className="block pb-8 flex-1">
              Mistral API Key (<i>{autocompleteModel.title}</i>)
              <Input
                className="w-full"
                placeholder="Enter your Mistral API Key"
                value={mistralApiKey}
                onChange={(e) => setMistralApiKey(e.target.value)}
              />
              <HelperText>
                <a href={mistral.apiKeyUrl} target="_blank">
                  Click here
                </a>{" "}
                to create a Mistral API key
              </HelperText>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}

export default DefaultModelConfigForm;
