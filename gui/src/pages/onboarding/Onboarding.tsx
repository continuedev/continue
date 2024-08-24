import {
  CheckBadgeIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";
import { ToCoreFromIdeOrWebviewProtocol } from "core/protocol/core";
import { useContext, useState } from "react";
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
import { Div, StyledButton } from "./components";
import { useOnboarding } from "./utils";
import { greenButtonColor } from "../../components";

enum ModelType {
  PearAI,
  Other,
}

type OnboardingMode =
  ToCoreFromIdeOrWebviewProtocol["completeOnboarding"][0]["mode"];

function Onboarding() {
  const [hovered, setHovered] = useState(-1);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const [hasSignedIntoGh, setHasSignedIntoGh] = useState(false);
  const [selectedOnboardingMode, setSlectedOnboardingMode] = useState<
    OnboardingMode | undefined
  >(undefined);

  const { completeOnboarding } = useOnboarding();

  function onSubmit() {
    ideMessenger.post("completeOnboarding", {
      mode: "custom",
    });

    /**
     * "completeOnboarding" above will update the config with our
     * new embeddings provider. If it's not the default local provider,
     * we need to re-index the codebase.
     */
    if (selectedOnboardingMode !== "local") {
      ideMessenger.post("index/forceReIndex", undefined);

  }
}

  const handleSelect = (selectedModel: ModelType) => {
    ideMessenger.post("completeOnboarding", {
      mode: "custom",
    });

    switch (selectedModel) {
      case ModelType.PearAI:
        navigate("/addModel/provider/pearai_server", { state: { referrer: "/onboarding" } });
        break;
      case ModelType.Other:
        navigate("/addModel/provider", { state: { showOtherProviders: true, referrer: "/onboarding" } });
        break;
      default:
        break;
    }
  };

  return (
    <div className="max-w-96  mx-auto leading-normal">
      <div className="leading-relaxed">
        <h1 className="text-center">Welcome to PearAI!</h1>
        <p className="text-center pb-2">
           Begin your journey by logging in on the PearAI. You can also add use your own API keys by clicking the
          <Cog6ToothIcon className="inline-block h-5 w-5 align-middle px-1" />
          icon in the bottom-right corner of this panel later.
        </p>
      </div>

      <div>
      <Div
        selected={false}
        onClick={() => handleSelect(ModelType.PearAI)}
        onMouseEnter={() => setHovered(ModelType.PearAI)}
        onMouseLeave={() => setHovered(-1)}
      >
        <div className="flex items-center">
          <img src={`${window.vscMediaUrl}/logos/pearai-color.png`} className="mr-1" height="24px"></img>
          <h3>PearAI Server </h3>
        </div>
        <p className="mt-0">
          Convenient, fully-managed integration, with the current best-in-market language models.
        </p>
        <p className="mt-0">
          Code is not stored.
        </p>
      </Div>
      <br></br>
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
                    text="Are you sure you want to skip setup? Unless you are an existing user or already have a config.json, we don't recommend this."
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
