import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Input, lightGray } from "../../components";
import { providers } from "../AddNewModel/configs/providers";
import styled from "styled-components";
import { StyledButton } from "./components";
import { models } from "../AddNewModel/configs/models";
import { useDispatch } from "react-redux";
import { setDefaultModel } from "../../redux/slices/stateSlice";

const HelperText = styled.p`
  font-size: 0.8rem;
  color: ${lightGray};
  margin-top: 0.25rem;
`;

function BestExperienceOnboarding() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [mistralApiKey, setMistralApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");

  const isFormComplete = !!mistralApiKey && !!anthropicApiKey;

  const { anthropic, mistral } = providers;
  const { claude35Sonnet, codestral } = models;

  async function handleSubmit(e) {
    e.preventDefault();

    const chatModel = {
      model: claude35Sonnet.params.model,
      provider: anthropic.provider,
      apiKey: anthropicApiKey,
      title: claude35Sonnet.params.title,
    };

    const autocompleteModel = {
      title: codestral.params.title,
      provider: mistral.provider,
      model: codestral.params.model,
      apiKey: mistralApiKey,
    };

    ideMessenger.post("config/addModel", { model: chatModel });

    dispatch(setDefaultModel({ title: chatModel.title, force: true }));

    await ideMessenger.request("addAutocompleteModel", {
      model: autocompleteModel,
    });

    ideMessenger.post("showTutorial", undefined);

    navigate("/");
  }

  return (
    <div className="p-2 max-w-96 mt-8 mx-auto">
      <div>
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate(-1)}
          className="inline-block cursor-pointer"
        />
      </div>

      <div className="pb-8">
        <h1 className="text-center">Enter your API keys</h1>
        <p className="text-center">
          Enter your API keys for Mistral and Anthropic below.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="block mb-8">
          Mistral API Key
          <Input
            className="w-full"
            placeholder="Enter your Mistral API Key"
            value={mistralApiKey}
            onChange={(e) => setMistralApiKey(e.target.value)}
          />
          <HelperText>
            <a href={mistral.apiKeyUrl}>Click here</a> to create a Mistral API
            key
          </HelperText>
        </label>

        <label className="block mb-8">
          Anthropic API Key
          <Input
            className="w-full"
            placeholder="Enter your Anthropic API Key"
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
          />
          <HelperText>
            <a href={anthropic.apiKeyUrl}>Click here</a> to create an Anthropic
            API key
          </HelperText>
        </label>

        <div className="flex flex-col justify-end mt-4">
          <StyledButton type="submit" disabled={!isFormComplete}>
            Complete onboarding
          </StyledButton>
        </div>
      </form>
    </div>
  );
}

export default BestExperienceOnboarding;
