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
import QuickModelSetup from "../../components/modelSelection/quickSetup/QuickModelSetup";
import { getLocalStorage } from "../../util/localStorage";
import Toggle from "../../components/modelSelection/Toggle";

const HelperText = styled.p`
  font-size: 0.8rem;
  color: ${lightGray};
  margin-top: 0.25rem;
`;

function ApiKeysOnboarding() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Controls the toggle between default and custom model setup
  const [isBestToggle, setIsBestToggle] = useState(true);

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
    <div className="p-8 overflow-y-scroll">
      <div>
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate(-1)}
          className="inline-block cursor-pointer"
        />
      </div>

      <div className="pb-8 text-center">
        <h1>Model setup</h1>
        <p>
          Choose between our default configuration that includes the best models
          available, or configure your own setup.
        </p>
      </div>

      <Toggle
        selected={isBestToggle}
        optionOne={"Best models"}
        optionTwo={"Configure your own"}
        onClick={() => {
          setIsBestToggle((prev) => !prev);
        }}
      />

      {isBestToggle && (
        <form onSubmit={handleSubmit} className="pt-8">
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

          <label className="block mb-4">
            Anthropic API Key
            <Input
              className="w-full"
              placeholder="Enter your Anthropic API Key"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
            />
            <HelperText>
              <a href={anthropic.apiKeyUrl}>Click here</a> to create an
              Anthropic API key
            </HelperText>
          </label>

          <div className="flex flex-col justify-end">
            <StyledButton type="submit" disabled={!isFormComplete}>
              Done
            </StyledButton>
          </div>
        </form>
      )}

      {!isBestToggle && (
        <QuickModelSetup
          onDone={() => {
            ideMessenger.post("showTutorial", undefined);

            if (getLocalStorage("signedInToGh")) {
              navigate("/");
            } else {
              navigate("/apiKeyAutocompleteOnboarding");
            }
          }}
        ></QuickModelSetup>
      )}
    </div>
  );
}

export default ApiKeysOnboarding;
