import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { defaultBorderRadius, lightGray } from "../../components";
import ConfirmationDialog from "../../components/dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { StyledButton } from "./components";
import { useOnboarding } from "./utils";
import styled from "styled-components";
import { providers } from "../AddNewModel/configs/providers";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import _ from "lodash";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { setLocalStorage } from "@/util/localStorage";

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

function Onboarding() {
  const [session, setSession] = useState(false)
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { completeOnboarding } = useOnboarding();

  useEffect(() => {
    if (!session) {
        ideMessenger.request("getPearAuth", undefined).then((res) => {
          const newSession = res.accessToken ? true : false;
          setSession(newSession)
          if (newSession) {
            setLocalStorage("onboardingStatus", "Completed");
            completeOnboarding()
          }
      });
    }
  }, [])

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
