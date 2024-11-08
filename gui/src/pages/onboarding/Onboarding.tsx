import { useContext, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { lightGray } from "../../components";
import ConfirmationDialog from "../../components/dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { StyledButton } from "./components";
import { useOnboarding } from "./utils";
import styled from "styled-components";
import _ from "lodash";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { Button } from "@/components/ui/button";

const EllipsisContainer = styled.span`
  display: inline-block;
  text-align: left;
  &::after {
    content: '';
    position: absolute;
    animation: ellipsis 1.5s steps(4, end) infinite;
  }

  @keyframes ellipsis {
    0%, 20% { content: ''; }
    40% { content: '.'; }
    60% { content: '..'; }
    80%, 100% { content: '...'; }
  }
`;

function Onboarding() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { completeOnboarding } = useOnboarding();

  useEffect(() => {
    if (window.isPearOverlay) {
      // Overlay can skip login step because user will login from sidebar
      navigate("/")
    }
  }, [])

  useWebviewListener("pearAISignedIn", async () => {
    completeOnboarding()
  });

  return (
    <div className="max-w-96 mx-auto flex flex-col items-center justify-between pt-8">
      <div className="flex flex-col items-center justify-center">
      <img
          src={`${window.vscMediaUrl}/logos/pearai-green.svg`}
          height="24px"
          style={{ marginRight: "5px" }}
        />
      <h1 className="text-center">Welcome to PearAI!</h1>
      <h3 className="mx-3 text-center flex">Begin your journey by logging in<EllipsisContainer /></h3>
      <Button 
        variant="animated"
        size="lg"
        className="m-5 flex flex-col justify-center items-center bg-button text-button-foreground"
        onClick={() => {
          ideMessenger.post("pearaiLogin", undefined);
        }}
      >
        <h3 className="font-medium">Log in</h3>

      </Button>

      <p className="mx-3">
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
      <div></div>
    </div>
  );
}

export default Onboarding;
