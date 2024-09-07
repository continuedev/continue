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
import { defaultBorderRadius, lightGray } from "../../components";
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
import styled from "styled-components";
import { providers } from "../AddNewModel/configs/providers";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import _ from "lodash";
import { useWebviewListener } from "../../hooks/useWebviewListener";

export const CustomModelButton = styled.div<{ disabled: boolean }>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.5s;

  ${(props) =>
    props.disabled
      ? `
    opacity: 0.5;
    `
      : `
  &:hover {
    border: 1px solid #be1b55;
    background-color: #be1b5522;
    cursor: pointer;
  }
  `}
`;

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
        navigate("/addModel/provider/pearai_server", {
          state: { referrer: "/onboarding" },
        });
        break;
      case ModelType.Other:
        navigate("/addModel/provider", {
          state: { showOtherProviders: true, referrer: "/onboarding" },
        });
        break;
      default:
        break;
    }
  };

  const modelInfo = providers["pearai_server"];

  // this runs when user successfully logins pearai
  useWebviewListener(
    "addPearAIModel",
    async () => {
      const pkg = modelInfo.packages[0];
      const dimensionChoices =
        pkg.dimensions?.map((d) => Object.keys(d.options)[0]) || [];
      const model = {
        ...pkg.params,
        ...modelInfo.params,
        ..._.merge(
          {},
          ...(pkg.dimensions?.map((dimension, i) => {
            if (!dimensionChoices?.[i]) {
              return {};
            }
            return {
              ...dimension.options[dimensionChoices[i]],
            };
          }) || []),
        ),
        provider: modelInfo.provider,
      };
      ideMessenger.post("config/addModel", { model });
      dispatch(setDefaultModel({ title: model.title, force: true }));
      navigate("/");
    },
    [modelInfo],
  );

  return (
    <div className="max-w-96  mx-auto leading-normal">
      <h1 className="text-center">Welcome to PearAI!</h1>
      <h3 className="mx-3 text-center">Begin your journey by logging in!</h3>
      <CustomModelButton
        className="m-5"
        disabled={false}
        onClick={() => {
          ideMessenger.post("pearaiLogin", undefined);
        }}
      >
        <h3 className="text-center my-2">Sign Up / Log In</h3>
        <img
          src={`${window.vscMediaUrl}/logos/${modelInfo?.icon}`}
          height="24px"
          style={{ marginRight: "5px" }}
        />
      </CustomModelButton>
      <p style={{ color: lightGray }} className="mx-3">
        After login, the website should redirect you back here.
      </p>
      <small
        style={{
          color: lightGray,
          fontSize: "0.85em",
          display: "block",
        }}
        className="mx-3"
      >
        Note: Having trouble logging in? Open PearAI from the dashboard on the{" "}
        <a
          href="https://trypear.ai/dashboard"
          target="_blank"
          rel="noopener noreferrer"
        >
          website
        </a>
        .
      </small>
      {/* <div>
        <Div
          selected={false}
          onClick={() => handleSelect(ModelType.PearAI)}
          onMouseEnter={() => setHovered(ModelType.PearAI)}
          onMouseLeave={() => setHovered(-1)}
        >
          <div className="flex items-center">
            <img
              src={`${window.vscMediaUrl}/logos/pearai-color.png`}
              className="mr-1"
              height="24px"
            ></img>
            <h3>PearAI Server </h3>
          </div>
          <p className="mt-0">
            Convenient, fully-managed integration, with the current
            best-in-market language models.
          </p>
          <p className="mt-0">Code is not stored.</p>
        </Div>
        <br></br>
      </div> */}
      <div className="absolute bottom-4 right-4">
        <StyledButton
          onClick={(e) => {
            dispatch(setShowDialog(true));
            dispatch(
              setDialogMessage(
                <ConfirmationDialog
                  text="Are you sure you want to skip logging in? Unless you are an existing user or already have a config.json, we don't recommend this."
                  onConfirm={() => {
                    completeOnboarding();
                  }}
                />,
              ),
            );
          }}
        >
          Skip
        </StyledButton>
      </div>
    </div>
  );
}

export default Onboarding;
