import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Input, lightGray } from "../../components";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import { models } from "../AddNewModel/configs/models";
import { providers } from "../AddNewModel/configs/providers";
import { StyledButton } from "./components";
import { useCompleteOnboarding } from "./utils";

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
      <div>
        <h2>
          Chat model - <i>{chatModel.title}</i>
        </h2>

        <p className="pb-6">{chatModel.description}</p>

        <label className="block pb-4">
          Anthropic API Key
          <Input
            className="w-full"
            placeholder="Enter your Anthropic API Key"
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
          />
          <HelperText>
            <a href={anthropic.apiKeyUrl} target="_blank">
              Click here
            </a>{" "}
            to create an Anthropic API key
          </HelperText>
        </label>
      </div>

      <div>
        <h2>
          Autocomplete model - <i>{autocompleteModel.title}</i>
        </h2>

        <p className="pb-6">{autocompleteModel.description}</p>

        <label className="block pb-8">
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

      <div className="flex justify-end">
        <StyledButton type="submit" disabled={!isFormComplete}>
          Done
        </StyledButton>
      </div>
    </form>
  );
}

export default DefaultModelConfigForm;
