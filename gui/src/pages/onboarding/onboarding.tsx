import {
  CheckBadgeIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { ToCoreFromIdeOrWebviewProtocol } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { lightGray } from "../../components";
import ConfirmationDialog from "../../components/dialogs/ConfirmationDialog";
import { ftl } from "../../components/dialogs/FTCDialog";
import GitHubSignInButton from "../../components/modelSelection/quickSetup/GitHubSignInButton";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { isJetBrains } from "../../util";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { Div, StyledButton } from "./components";

type OnboardingMode =
  ToCoreFromIdeOrWebviewProtocol["completeOnboarding"][0]["mode"];

function Onboarding() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const [selectedOnboardingMode, setSlectedOnboardingMode] = useState<
    OnboardingMode | undefined
  >(undefined);

  useEffect(() => {
    setLocalStorage("onboardingComplete", true);
  }, []);

  function handleContinueClick() {
    ideMessenger.post("completeOnboarding", {
      mode: selectedOnboardingMode,
    });

    /**
     * "completeOnboarding" above will update the config with our
     * new embeddings provider. If it's not the default local provider,
     * we need to re-index the codebase.
     */
    if (selectedOnboardingMode !== "local") {
      ideMessenger.post("index/forceReIndex", undefined);
    }

    switch (selectedOnboardingMode) {
      case "local":
        navigate("/localOnboarding");
        break;

      case "bestExperience":
        navigate("/bestExperienceOnboarding");
        break;

      case "apiKeys":
        navigate("/apiKeyOnboarding");
        break;

      default:
        break;
    }
  }

  return (
    <div className="p-2 max-w-96  mx-auto">
      <div className="leading-relaxed">
        {getLocalStorage("ftc") > ftl() ? (
          <>
            <h1 className="text-center">Free trial limit reached</h1>
            <p className="text-center">
              To keep using Continue, please select a configuration option below
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center">Welcome to Continue</h1>
            <p className="text-center ">
              Let's find the setup that works best for you. You can update your
              configuration after onboarding by clicking the
              <Cog6ToothIcon className="inline-block h-5 w-5 align-middle px-1" />
              icon in the bottom-right corner of Continue.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-6 py-8">
        <Div
          selected={selectedOnboardingMode === "local"}
          onClick={() => setSlectedOnboardingMode("local")}
        >
          <h3>
            <ComputerDesktopIcon
              width="1.4em"
              height="1.4em"
              className="align-middle pr-2"
            />
            Local models
          </h3>
          <p>
            No code will leave your computer, but less powerful models are used.
          </p>

          <ul className="pl-4 space-y-2">
            <li>
              <b>Chat:</b> Llama 3 with Ollama, LM Studio, etc.
            </li>
            <li>
              <b>Embeddings:</b> Nomic Embed
            </li>
            <li>
              <b>Autocomplete:</b> Starcoder2 3B
            </li>
          </ul>
        </Div>

        <Div
          selected={selectedOnboardingMode === "bestExperience"}
          onClick={() => setSlectedOnboardingMode("bestExperience")}
        >
          <h3>
            <CheckBadgeIcon
              width="1.4em"
              height="1.4em"
              className="align-middle pr-2"
            />
            Best possible experience
          </h3>
          <p>The most powerful models available.</p>

          <ul className="pl-4 space-y-2">
            <li>
              <b>Chat:</b> Claude 3.5 Sonnet
            </li>
            <li>
              <b>Embeddings:</b> Voyage Code 2
            </li>
            <li>
              <b>Autocomplete:</b> Codestral
            </li>
          </ul>
        </Div>

        <Div
          selected={selectedOnboardingMode === "apiKeys"}
          onClick={() => setSlectedOnboardingMode("apiKeys")}
        >
          <h3>
            <Cog6ToothIcon
              width="1.4em"
              height="1.4em"
              className="align-middle pr-2"
            />
            Choose a chat model
          </h3>
          <p>
            Choose a chat model from OpenAI, Mistral, or any other provider.
          </p>
          <ul className="pl-4 space-y-2">
            <li>
              <b>Chat:</b> Your choice
            </li>
            <li>
              <b>Embeddings:</b> Voyage Code 2
            </li>
            <li>
              <b>Autocomplete:</b> Starcoder 7B via Fireworks AI
            </li>
          </ul>
        </Div>
      </div>

      <div className="flex">
        <div className="flex items-center gap-4 ml-auto">
          <div
            className="cursor-pointer"
            style={{ color: lightGray }}
            onClick={(e) => {
              dispatch(setShowDialog(true));
              dispatch(
                setDialogMessage(
                  <ConfirmationDialog
                    text="Are you sure you want to skip onboarding? Unless you are an existing user or already have a config.json we don't recommend this."
                    onConfirm={() => {
                      setLocalStorage("onboardingComplete", true);
                      navigate("/");
                    }}
                  />,
                ),
              );
            }}
          >
            Skip
          </div>
          <StyledButton
            disabled={!selectedOnboardingMode}
            onClick={handleContinueClick}
          >
            Continue
          </StyledButton>
        </div>
      </div>

      {(!getLocalStorage("onboardingComplete") || isJetBrains()) && (
        <>
          <hr className="w-full my-12"></hr>

          <p className="text-center">
            OR sign in with GitHub to try 25 free requests
          </p>
          <GitHubSignInButton
            onComplete={async (token) => {
              await ideMessenger.request("completeOnboarding", {
                mode: "freeTrial",
              });
              navigate("/");
            }}
          ></GitHubSignInButton>
        </>
      )}
    </div>
  );
}

export default Onboarding;
