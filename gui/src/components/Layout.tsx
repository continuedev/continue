import { ExtensionConflictReport } from "core";
import { useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv, defaultBorderRadius } from ".";
import { AuthProvider } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { LocalStorageProvider } from "../context/LocalStorage";
import GraniteOnboardingCard from "../granite/GraniteOnboardingCard";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCodeToEdit } from "../redux/slices/editState";
import { setShowDialog } from "../redux/slices/uiSlice";
import { enterEdit, exitEdit } from "../redux/thunks/edit";
import { saveCurrentSession } from "../redux/thunks/session";
import { fontSize, isMetaEquivalentKeyPressed } from "../util";
import { incrementFreeTrialCount } from "../util/freeTrial";
import { ROUTES } from "../util/navigation";
import { FatalErrorIndicator } from "./config/FatalErrorNotice";
import TextDialog from "./dialogs";
import Footer from "./Footer";
import IncompatibleExtensionsOverlay from "./IncompatibleExtensionsOverlay";
import { LumpProvider } from "./mainInput/Lump/LumpContext";
import { useMainEditor } from "./mainInput/TipTapEditor";
import OSRContextMenu from "./OSRContextMenu";
import PostHogPageView from "./PosthogPageView";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  border-radius: ${defaultBorderRadius};
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
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [showGraniteOnboardingCard, setShowGraniteOnboardingCard] =
    useState<boolean>(window.showGraniteCodeOnboarding ?? false);

  const { mainEditor } = useMainEditor();
  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);

  const showDialog = useAppSelector((state) => state.ui.showDialog);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);

  const [conflictingInfo, setConflictingInfo] =
    useState<ExtensionConflictReport | null>(null);

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
    [location.pathname],
    location.pathname === ROUTES.HOME,
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
    [location.pathname, isInEdit],
    location.pathname === ROUTES.HOME,
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
    "incrementFtc",
    async () => {
      incrementFreeTrialCount();
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
    "setShowGraniteOnboardingCard",
    async (state) => {
      setShowGraniteOnboardingCard(state as boolean);
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

  useWebviewListener("updateIncompatibleExtensions", async (data) => {
    setConflictingInfo(data);
  });

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (isMetaEquivalentKeyPressed(event) && event.code === "KeyC") {
        const selection = window.getSelection()?.toString();
        if (selection) {
          // Copy to clipboard
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

  // When the webview is on mount, check if there are any incompatible extension enabled, and if the onboardingCard should be shown
  useEffect(() => {
    ideMessenger.post("onWebviewLoad", undefined);
  }, []);

  return showGraniteOnboardingCard ? (
    <GraniteOnboardingCard />
  ) : (
    <>
    {conflictingInfo !== null && (
      <IncompatibleExtensionsOverlay conflictingInfo={conflictingInfo} />
    )}
    <LocalStorageProvider>
      <AuthProvider>
        <LayoutTopDiv>
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

              <GridDiv className="">
                <PostHogPageView />
                <Outlet />
                <FatalErrorIndicator />
                <Footer />
              </GridDiv>
            </div>
            <div style={{ fontSize: fontSize(-4) }} id="tooltip-portal-div" />
          </LumpProvider>
        </LayoutTopDiv>
      </AuthProvider>
    </LocalStorageProvider>
    </>
  );
};

export default Layout;
