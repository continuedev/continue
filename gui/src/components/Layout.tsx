import { OnboardingModes } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv } from ".";
import { AuthProvider } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { LocalStorageProvider } from "../context/LocalStorage";
import TelemetryProviders from "../hooks/TelemetryProviders";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCodeToEdit } from "../redux/slices/editState";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { enterEdit, exitEdit } from "../redux/thunks/edit";
import { saveCurrentSession } from "../redux/thunks/session";
import { fontSize, isMetaEquivalentKeyPressed } from "../util";
import { incrementFreeTrialCount } from "../util/freeTrial";
import { ROUTES } from "../util/navigation";
import { FatalErrorIndicator } from "./config/FatalErrorNotice";
import TextDialog from "./dialogs";
import { GenerateRuleDialog } from "./GenerateRuleDialog";
import { LumpProvider } from "./mainInput/Lump/LumpContext";
import { useMainEditor } from "./mainInput/TipTapEditor";
import {
  isNewUserOnboarding,
  OnboardingCard,
  useOnboardingCard,
} from "./OnboardingCard";
import OSRContextMenu from "./OSRContextMenu";
import PostHogPageView from "./PosthogPageView";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  border-radius: 0;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

const Layout = () => {
  const [showStagingIndicator, setShowStagingIndicator] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const onboardingCard = useOnboardingCard();
  const ideMessenger = useContext(IdeMessengerContext);

  const { mainEditor } = useMainEditor();
  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);

  const showDialog = useAppSelector((state) => state.ui.showDialog);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);

  useEffect(() => {
    (async () => {
      const response = await ideMessenger.request(
        "controlPlane/getEnvironment",
        undefined,
      );
      response.status === "success" &&
        setShowStagingIndicator(response.content.AUTH_TYPE.includes("staging"));
    })();
  }, []);

  useWebviewListener(
    "newSession",
    async () => {
      navigate(ROUTES.HOME);
      if (isInEdit) {
        await dispatch(exitEdit({}));
      } else {
        await dispatch(
          saveCurrentSession({
            timestamp: Date.now(),
          }),
        );
      }
    },
    [location.pathname, isInEdit],
  );

  useWebviewListener(
    "enterEdit",
    async (data: { text: string }) => {
      const text = data.text;
      dispatch(setCodeToEdit(text));
      await dispatch(enterEdit({}));
    },
    [],
  );

  useWebviewListener(
    "exitEdit",
    async () => {
      await dispatch(exitEdit({}));
    },
    [],
  );

  useWebviewListener(
    "incrementFreeTrialCount",
    async () => {
      incrementFreeTrialCount();
    },
    [],
  );

  useWebviewListener(
    "showOnboarding",
    async (data) => {
      const mode = data.mode;
      switch (mode) {
        case OnboardingModes.Best:
          onboardingCard.open(
            (onClose) => (
              <OnboardingCard
                onClose={onClose}
                mode={OnboardingModes.Best}
                title="Choose the best models for your use case"
                description="Continue supports many of the most popular models and model providers. Here are some suggestions based on what the community has found works well."
              />
            ),
            "top-onboarding-card",
          );
          break;
        case OnboardingModes.Local:
          onboardingCard.open(
            (onClose) => (
              <OnboardingCard
                onClose={onClose}
                mode={OnboardingModes.Local}
                title="Use local models for free"
                description="If you want to use Continue for free forever, you can run a local model from Ollama."
              />
            ),
            "top-onboarding-card",
          );
          break;
        case OnboardingModes.Quickstart:
          onboardingCard.open((onClose) => <OnboardingCard onClose={onClose} />);
          break;
      }
    },
    [],
  );

  useWebviewListener(
    "onboardingViewModelDetails",
    async (data) => {
      const { mode } = data;
      navigate(`/config?view=models&mode=${mode}`);
    },
    [],
  );

  useWebviewListener(
    "navigateToPage",
    async (data) => {
      navigate(data.page);
    },
    [],
  );

  useWebviewListener(
    "completeOnboarding",
    async (data) => {
      localStorage.setItem("onboardingComplete", "true");
      onboardingCard.close();
    },
    [],
  );

  useWebviewListener(
    "openUrl",
    async (data) => {
      ideMessenger.post("openUrl", data.url);
    },
    [],
  );

  useWebviewListener(
    "openConfigPath",
    async () => {
      const result = await ideMessenger.request("getConfigJsonPath", undefined);
      if (result.status === "success") {
        ideMessenger.post("openFile", { path: result.content });
      }
    },
    [],
  );

  useWebviewListener(
    "showFeedback",
    async () => {
      dispatch(setShowDialog(true));
      dispatch(
        setDialogMessage(
          <div className="p-4 text-center">
            <h3 className="text-lg font-semibold mb-4">
              How has your experience been so far?
            </h3>
            <div className="flex gap-4 justify-center">
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={() => {
                  ideMessenger.post("openUrl", "https://forms.gle/feedback-form");
                  dispatch(setShowDialog(false));
                }}
              >
                Great! 👍
              </button>
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded"
                onClick={() => {
                  ideMessenger.post("openUrl", "https://github.com/continuedev/continue/issues");
                  dispatch(setShowDialog(false));
                }}
              >
                Could be better 📝
              </button>
            </div>
          </div>
        ),
      );
    },
    [],
  );

  useWebviewListener(
    "signInToControlPlane",
    async () => {
      navigate("/config");
    },
    [],
  );

  useWebviewListener(
    "navigateToOnboarding",
    async () => {
      onboardingCard.open((onClose) => <OnboardingCard onClose={onClose} />);
    },
    [],
  );

  useWebviewListener(
    "generateRule",
    async () => {
      dispatch(setShowDialog(true));
      dispatch(setDialogMessage(<GenerateRuleDialog />));
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (isMetaEquivalentKeyPressed(event) && event.code === "KeyC") {
        const selection = window.getSelection()?.toString();
        if (selection) {
          setTimeout(() => {
            void navigator.clipboard.writeText(selection);
          }, 100);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (
      isNewUserOnboarding() &&
      (location.pathname === "/" || location.pathname === "/index.html")
    ) {
      onboardingCard.open();
    }
  }, [location]);

  return (
    <LocalStorageProvider>
      <AuthProvider>
        <TelemetryProviders>
          <LayoutTopDiv>
            {showStagingIndicator && (
              <span
                title="Staging environment"
                className="absolute right-0 mx-1.5 h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: "var(--vscode-list-warningForeground)",
                }}
              />
            )}
            <LumpProvider>
              <OSRContextMenu />
              <div
                style={{
                  scrollbarGutter: "stable both-edges",
                  minHeight: "100%",
                  display: "grid",
                  gridTemplateRows: "1fr auto",
                }}
              >
                <TextDialog
                  showDialog={showDialog}
                  onEnter={() => {
                    dispatch(setShowDialog(false));
                  }}
                  onClose={() => {
                    dispatch(setShowDialog(false));
                  }}
                  message={dialogMessage}
                />

                <GridDiv>
                  <PostHogPageView />
                  <Outlet />
                  <FatalErrorIndicator />
                </GridDiv>
              </div>
              <div style={{ fontSize: fontSize(-4) }} id="tooltip-portal-div" />
            </LumpProvider>
          </LayoutTopDiv>
        </TelemetryProviders>
      </AuthProvider>
    </LocalStorageProvider>
  );
};

export default Layout;