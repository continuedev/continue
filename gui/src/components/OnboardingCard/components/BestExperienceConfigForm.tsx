import { CubeIcon } from "@heroicons/react/24/outline";
import { FormEventHandler, useContext, useState } from "react";
import { Button, Input, InputSubtext, lightGray } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { models } from "../../../pages/AddNewModel/configs/models";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { useAppDispatch } from "../../../redux/hooks";
import { updateSelectedModelByRole } from "../../../redux/thunks";
import AddModelButtonSubtext from "../../AddModelButtonSubtext";

const { anthropic, mistral } = providers;
const chatProvider = anthropic!;
const autocompleteProvider = mistral!;

const {
  claude35Sonnet: chatModel,
  claude35Haiku: repoMapModel,
  codestral: autocompleteModel,
} = models;

interface BestExperienceConfigFormProps {
  onComplete: () => void;
}

function BestExperienceConfigForm({
  onComplete,
}: BestExperienceConfigFormProps) {
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();

  const ideMessenger = useContext(IdeMessengerContext);

  const [autocompleteApiKey, setAutocompleteApiKey] = useState("");
  const [chatApiKey, setChatApiKey] = useState("");

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    const chatModelConfig = {
      model: chatModel.params.model,
      provider: chatProvider.provider,
      apiKey: chatApiKey,
      title: chatModel.params.title,
    };

    const repoMapConfig = {
      model: repoMapModel.params.model,
      provider: chatProvider.provider,
      apiKey: chatApiKey,
      title: repoMapModel.params.title,
    };

    const autocompleteModelConfig = {
      title: autocompleteModel.params.title,
      provider: autocompleteProvider.provider,
      model: autocompleteModel.params.model,
      apiKey: autocompleteApiKey,
    };

    ideMessenger.post("config/addModel", { model: chatModelConfig });
    ideMessenger.post("config/addModel", {
      model: repoMapConfig,
      role: "repoMapFileSelection",
    });

    dispatch(
      updateSelectedModelByRole({
        selectedProfile,
        role: "chat",
        modelTitle: chatModelConfig.title,
      }),
    );

    if (!!autocompleteApiKey) {
      await ideMessenger.request("addAutocompleteModel", {
        model: autocompleteModelConfig,
      });
    }

    onComplete();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 flex flex-row justify-between gap-4 text-lg font-bold">
            <label className="text-lg font-bold">Chat model</label>
            <div
              className="hidden items-center justify-end text-xs font-semibold sm:flex"
              style={{ color: lightGray }}
            >
              <CubeIcon className="mr-1 h-4 w-4 flex-shrink-0" />
              <span className="inline text-right italic">
                {chatModel.title}{" "}
                <span className="hidden md:inline">by Anthropic</span>
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col pb-4">
            <Input
              placeholder="Enter your Anthropic API Key"
              value={chatApiKey}
              onChange={(e) => setChatApiKey(e.target.value)}
              data-testid="best-chat-api-key-input"
            />
            <InputSubtext>
              <a
                href={chatProvider.apiKeyUrl}
                target="_blank"
                className="cursor-pointer text-inherit underline hover:text-inherit"
              >
                Click here
              </a>{" "}
              to create an Anthropic API key
            </InputSubtext>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-row justify-between gap-4 text-lg font-bold">
            <label className="text-lg font-bold">Autocomplete model</label>
            <div
              className="flex hidden items-center text-xs font-semibold sm:flex"
              style={{ color: lightGray }}
            >
              <CubeIcon className="mr-1 inline h-4 w-4 flex-shrink-0" />
              <span className="text-right italic">
                {autocompleteModel.title}{" "}
                <span className="hidden md:inline">by Mistral</span>
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col pb-4">
            <Input
              placeholder="Enter your Mistral API Key"
              value={autocompleteApiKey}
              onChange={(e) => setAutocompleteApiKey(e.target.value)}
              data-testid="best-autocomplete-api-key-input"
            />
            <InputSubtext>
              <a
                href={autocompleteProvider.apiKeyUrl}
                target="_blank"
                className="cursor-pointer text-inherit underline hover:text-inherit"
              >
                Click here
              </a>{" "}
              to create a Mistral API key
            </InputSubtext>
          </div>
        </div>

        <div className="w-full">
          <Button className="w-full" type="submit" disabled={!chatApiKey}>
            Connect
          </Button>
          <AddModelButtonSubtext />
        </div>
      </div>
    </form>
  );
}

export default BestExperienceConfigForm;
