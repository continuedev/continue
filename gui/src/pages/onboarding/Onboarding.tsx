import {
  CheckBadgeIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";
import { ToCoreFromIdeOrWebviewProtocol } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { lightGray } from "../../components";
import ConfirmationDialog from "../../components/dialogs/ConfirmationDialog";
import GitHubSignInButton from "../../components/modelSelection/quickSetup/GitHubSignInButton";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { isJetBrains } from "../../util";
import { FREE_TRIAL_LIMIT_REQUESTS, hasPassedFTL } from "../../util/freeTrial";
import { Div, StyledButton } from "./components";
import { isNewUserOnboarding, useCompleteOnboarding } from "./utils";
import { setLocalStorage } from "../../util/localStorage";
import { usePostHog } from "posthog-js/react";

type OnboardingMode =
  ToCoreFromIdeOrWebviewProtocol["completeOnboarding"][0]["mode"];

function Onboarding() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const posthog = usePostHog();
  const ideMessenger = useContext(IdeMessengerContext);

  const [hasSignedIntoGh, setHasSignedIntoGh] = useState(false);
  const [selectedOnboardingMode, setSlectedOnboardingMode] = useState<
    OnboardingMode | undefined
  >(undefined);

  const { completeOnboarding } = useCompleteOnboarding();

  function onSubmit() {
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

      case "apiKeys":
        navigate("/apiKeysOnboarding");
        break;

      case "freeTrial":
        completeOnboarding();
        break;

      default:
        break;
    }
  }

  useEffect(() => {
    if (isNewUserOnboarding()) {
      posthog.capture("Onboarding Step", { status: "Started" });
      setLocalStorage("onboardingStatus", "Started");
    }
  }, []);

  return (
    <div className="max-w-96 mx-auto leading-normal">
      <div className="leading-relaxed">
        <h1 className="text-center">Welcome to Continue</h1>
        <p className="text-center ">
          Let's find the setup that works best for you. You can update your
          configuration after onboarding by clicking the
          <Cog6ToothIcon className="inline-block h-5 w-5 align-middle px-1" />
          icon in the bottom-right corner of Continue.
        </p>
      </div>

      <div className="flex flex-col gap-6 pb-8 pt-4">
        {(!hasPassedFTL() || isJetBrains()) && (
          <Div
            selected={selectedOnboardingMode === "freeTrial"}
            onClick={() => setSlectedOnboardingMode("freeTrial")}
          >
            <h3>
              <GiftIcon
                width="1.4em"
                height="1.4em"
                className="align-middle pr-2"
              />
              Free trial
            </h3>
            <p>
              Start your free trial of {FREE_TRIAL_LIMIT_REQUESTS} requests by
              signing into GitHub.
            </p>

            <ul className="pl-4 mb-0">
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

            {!hasSignedIntoGh && (
              <div className="flex justify-center py-3">
                <GitHubSignInButton
                  onComplete={() => setHasSignedIntoGh(true)}
                ></GitHubSignInButton>
              </div>
            )}
          </Div>
        )}
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

          <ul className="pl-4 ">
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
          selected={selectedOnboardingMode === "apiKeys"}
          onClick={() => setSlectedOnboardingMode("apiKeys")}
        >
          <h3>
            <CheckBadgeIcon
              width="1.4em"
              height="1.4em"
              className="align-middle pr-2"
            />
            Best experience
          </h3>
          <p>
            Start with the most powerful models available, or customize your own
            configuration.
          </p>

          <ul className="pl-4 ">
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
      </div>

      <div className="flex justify-end">
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
                      completeOnboarding();
                    }}
                  />,
                ),
              );
            }}
          >
            Skip
          </div>
          <StyledButton disabled={!selectedOnboardingMode} onClick={onSubmit}>
            Continue
          </StyledButton>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
