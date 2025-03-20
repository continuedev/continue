import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv, defaultBorderRadius } from ".";
import { AuthProvider } from "../context/Auth";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { selectUseHub } from "../redux/selectors";
import { focusEdit, setEditStatus } from "../redux/slices/editModeState";
import {
  addCodeToEdit,
  newSession,
  selectIsInEditMode,
  setMode,
  updateApplyState,
} from "../redux/slices/sessionSlice";
import { setShowDialog } from "../redux/slices/uiSlice";
import { exitEditMode } from "../redux/thunks";
import { loadLastSession, saveCurrentSession } from "../redux/thunks/session";
import { getFontSize, isMetaEquivalentKeyPressed } from "../util";
import { incrementFreeTrialCount } from "../util/freeTrial";
import { ROUTES } from "../util/navigation";
import TextDialog from "./dialogs";
import Footer from "./Footer";
import { isNewUserOnboarding, useOnboardingCard } from "./OnboardingCard";
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
  const onboardingCard = useOnboardingCard();
  const { pathname } = useLocation();

  const configError = useAppSelector((state) => state.config.configError);

  const hasFatalErrors = useMemo(() => {
    return configError?.some((error) => error.fatal);
  }, [configError]);

  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);

  const showDialog = useAppSelector((state) => state.ui.showDialog);

  useWebviewListener(
    "newSession",
    async () => {
      navigate(ROUTES.HOME);
      await dispatch(
        saveCurrentSession({
          openNewSession: true,
          generateTitle: true,
        }),
      );
      dispatch(exitEditMode());
    },
    [],
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
      await dispatch(
        saveCurrentSession({
          openNewSession: true,
          generateTitle: true,
        }),
      );
      dispatch(exitEditMode());
    },
    [location.pathname],
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
    "updateApplyState",
    async (state) => {
      // dispatch(
      //   updateCurCheckpoint({
      //     filepath: state.filepath,
      //     content: state.fileContent,
      //   }),
      // );
      dispatch(updateApplyState(state));
    },
    [],
  );

  useWebviewListener(
    "openOnboardingCard",
    async () => {
      onboardingCard.open("Best");
    },
    [],
  );

  useWebviewListener(
    "setupLocalConfig",
    async () => {
      onboardingCard.open("Local");
    },
    [],
  );

  useWebviewListener(
    "focusEdit",
    async () => {
      await dispatch(
        saveCurrentSession({
          openNewSession: false,
          // Because this causes a lag before Edit mode is focused. TODO just have that happen in background
          generateTitle: false,
        }),
      );
      dispatch(newSession());
      dispatch(focusEdit());
      dispatch(setMode("edit"));
    },
    [],
  );

  useWebviewListener(
    "focusEditWithoutClear",
    async () => {
      await dispatch(
        saveCurrentSession({
          openNewSession: true,
          generateTitle: true,
        }),
      );
      dispatch(focusEdit());
      dispatch(setMode("edit"));
    },
    [],
  );

  useWebviewListener(
    "addCodeToEdit",
    async (payload) => {
      dispatch(addCodeToEdit(payload));
    },
    [navigate],
  );

  useWebviewListener(
    "setEditStatus",
    async ({ status, fileAfterEdit }) => {
      dispatch(setEditStatus({ status, fileAfterEdit }));
    },
    [],
  );

  const isInEditMode = useAppSelector(selectIsInEditMode);
  useWebviewListener(
    "exitEditMode",
    async () => {
      if (!isInEditMode) {
        return;
      }
      dispatch(
        loadLastSession({
          saveCurrentSession: false,
        }),
      );
      dispatch(exitEditMode());
    },
    [isInEditMode],
  );

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (isMetaEquivalentKeyPressed(event) && event.code === "KeyC") {
        const selection = window.getSelection()?.toString();
        if (selection) {
          // Copy to clipboard
          setTimeout(() => {
            navigator.clipboard.writeText(selection);
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
      onboardingCard.open("Quickstart");
    }
  }, [location]);

  const useHub = useAppSelector(selectUseHub);

  // Existing users that have already seen the onboarding card
  // should be shown an intro card for hub.continue.dev
  // useEffect(() => {
  //   if (useHub !== true) {
  //     return;
  //   }
  //   const seenHubIntro = getLocalStorage("seenHubIntro");
  //   if (!onboardingCard.show && !seenHubIntro) {
  //     onboardingCard.setActiveTab("ExistingUserHubIntro");
  //   }
  //   setLocalStorage("seenHubIntro", true);
  // }, [onboardingCard.show, useHub]);

  return (
    <AuthProvider>
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

          <GridDiv className="">
            <PostHogPageView />
            <Outlet />

            {hasFatalErrors && pathname !== ROUTES.CONFIG_ERROR && (
              <div
                className="z-50 cursor-pointer bg-red-600 p-4 text-center text-white"
                role="alert"
                onClick={() => navigate(ROUTES.CONFIG_ERROR)}
              >
                <strong className="font-bold">Error!</strong>{" "}
                <span className="block sm:inline">Could not load config</span>
                <div className="mt-2 underline">Learn More</div>
              </div>
            )}
            <Footer />
          </GridDiv>
        </div>
        <div
          style={{ fontSize: `${getFontSize() - 4}px` }}
          id="tooltip-portal-div"
        />
      </LayoutTopDiv>
    </AuthProvider>
  );
};

export default Layout;
