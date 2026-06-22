import { OnboardingModes } from "core/protocol/core";
<<<<<<< HEAD
import { useContext, useEffect, useState } from "react";
=======
import { useContext, useEffect } from "react";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv } from ".";
import { AuthProvider } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { LocalStorageProvider } from "../context/LocalStorage";
<<<<<<< HEAD
import TelemetryProviders from "../hooks/TelemetryProviders";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCodeToEdit } from "../redux/slices/editState";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
=======
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCodeToEdit } from "../redux/slices/editState";
import { setShowDialog } from "../redux/slices/uiSlice";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { enterEdit, exitEdit } from "../redux/thunks/edit";
import { saveCurrentSession } from "../redux/thunks/session";
import { fontSize, isMetaEquivalentKeyPressed } from "../util";
import { ROUTES } from "../util/navigation";
import { FatalErrorIndicator } from "./config/FatalErrorNotice";
import TextDialog from "./dialogs";
<<<<<<< HEAD
import { GenerateRuleDialog } from "./GenerateRuleDialog";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { useMainEditor } from "./mainInput/TipTapEditor";
import {
  isNewUserOnboarding,
  OnboardingCard,
  useOnboardingCard,
} from "./OnboardingCard";
import OSRContextMenu from "./OSRContextMenu";
<<<<<<< HEAD
import PostHogPageView from "./PosthogPageView";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  position: relative;
  overflow-x: hidden;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

const Layout = () => {
<<<<<<< HEAD
  const [showStagingIndicator, setShowStagingIndicator] = useState(false);
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const onboardingCard = useOnboardingCard();
  const ideMessenger = useContext(IdeMessengerContext);

  const { mainEditor } = useMainEditor();
  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);

  const showDialog = useAppSelector((state) => state.ui.showDialog);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const isHome =
    location.pathname === ROUTES.HOME ||
    location.pathname === ROUTES.HOME_INDEX;

<<<<<<< HEAD
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

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  useWebviewListener(
    "newSession",
    async () => {
      navigate(ROUTES.HOME);
      if (isInEdit) {
        await dispatch(exitEdit({}));
      } else {
        await dispatch(
          saveCurrentSession({
            openNewSession: true,
            generateTitle: true,
          }),
        );
      }
    },
    [isInEdit],
  );

  useWebviewListener(
    "isContinueInputFocused",
    async () => {
      return false;
    },
    [isHome],
    isHome,
  );

  useWebviewListener(
    "focusContinueInputWithNewSession",
    async () => {
      navigate(ROUTES.HOME);
      if (isInEdit) {
        await dispatch(
          exitEdit({
            openNewSession: true,
          }),
        );
      } else {
        await dispatch(
          saveCurrentSession({
            openNewSession: true,
            generateTitle: true,
          }),
        );
      }
    },
    [isHome, isInEdit],
    isHome,
  );

  useWebviewListener(
    "addModel",
    async () => {
      navigate("/models");
    },
    [navigate],
  );

  useWebviewListener(
    "navigateTo",
    async (data) => {
      if (data.toggle && location.pathname === data.path) {
        navigate("/");
      } else {
        navigate(data.path);
      }
    },
    [location, navigate],
  );

  useWebviewListener(
    "setupLocalConfig",
    async () => {
      onboardingCard.open(OnboardingModes.LOCAL);
    },
    [],
  );

  useWebviewListener(
<<<<<<< HEAD
    "freeTrialExceeded",
    async () => {
      dispatch(setShowDialog(true));
      onboardingCard.setActiveTab(OnboardingModes.MODELS_ADD_ON);
      dispatch(
        setDialogMessage(
          <div className="flex-1">
            <OnboardingCard isDialog />
          </div>,
        ),
      );
    },
    [],
  );

  useWebviewListener(
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    "setupApiKey",
    async () => {
      onboardingCard.open(OnboardingModes.API_KEY);
    },
    [],
  );

  useWebviewListener(
    "focusEdit",
    async () => {
      await ideMessenger.request("edit/addCurrentSelection", undefined);
      await dispatch(enterEdit({ editorContent: mainEditor?.getJSON() }));
      mainEditor?.commands.focus();
    },
    [ideMessenger, mainEditor],
  );

  useWebviewListener(
    "setCodeToEdit",
    async (payload) => {
      dispatch(
        setCodeToEdit({
          codeToEdit: payload,
        }),
      );
    },
    [],
  );

  useWebviewListener(
    "exitEditMode",
    async () => {
      await dispatch(exitEdit({}));
    },
    [],
  );

<<<<<<< HEAD
  useWebviewListener(
    "generateRule",
    async () => {
      dispatch(setShowDialog(true));
      dispatch(setDialogMessage(<GenerateRuleDialog />));
    },
    [],
  );

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
    if (isNewUserOnboarding() && isHome) {
      onboardingCard.open();
    }
  }, [isHome]);

  return (
    <LocalStorageProvider>
      <AuthProvider>
<<<<<<< HEAD
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
                {/* The fatal error for chat is shown below input */}
                {!isHome && <FatalErrorIndicator />}
              </GridDiv>
            </div>
            <div style={{ fontSize: fontSize(-4) }} id="tooltip-portal-div" />
          </LayoutTopDiv>
        </TelemetryProviders>
=======
        <LayoutTopDiv>
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
              <Outlet />
              {/* The fatal error for chat is shown below input */}
              {!isHome && <FatalErrorIndicator />}
            </GridDiv>
          </div>
          <div style={{ fontSize: fontSize(-4) }} id="tooltip-portal-div" />
        </LayoutTopDiv>
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      </AuthProvider>
    </LocalStorageProvider>
  );
};

export default Layout;
