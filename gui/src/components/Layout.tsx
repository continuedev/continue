import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv, defaultBorderRadius } from ".";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setEditStatus, focusEdit } from "../redux/slices/editModeState";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import {
  addCodeToEdit,
  updateApplyState,
  setMode,
  newSession,
} from "../redux/slices/sessionSlice";
import { getFontSize, isMetaEquivalentKeyPressed } from "../util";
import { ROUTES } from "../util/navigation";
import TextDialog from "./dialogs";
import Footer from "./Footer";
import { isNewUserOnboarding, useOnboardingCard } from "./OnboardingCard";
import PostHogPageView from "./PosthogPageView";
import AccountDialog from "./AccountDialog";
import { AuthProvider } from "../context/Auth";
import { exitEditMode } from "../redux/thunks";
import { loadLastSession, saveCurrentSession } from "../redux/thunks/session";
import { incrementFreeTrialCount } from "../util/freeTrial";

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
        }),
      );
      dispatch(exitEditMode());
    },
    [location.pathname],
    location.pathname === ROUTES.HOME,
  );

  useWebviewListener(
    "openDialogMessage",
    async (message) => {
      if (message === "account") {
        dispatch(setShowDialog(true));
        dispatch(setDialogMessage(<AccountDialog />));
      }
    },
    [],
  );

  useWebviewListener(
    "addModel",
    async () => {
      navigate("/models");
    },
    [navigate],
  );

  useWebviewListener(
    "viewHistory",
    async () => {
      // Toggle the history page / main page
      if (location.pathname === "/history") {
        navigate("/");
      } else {
        navigate("/history");
      }
    },
    [location, navigate],
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

  useWebviewListener("exitEditMode", async () => {
    dispatch(
      loadLastSession({
        saveCurrentSession: false,
      }),
    );
    dispatch(exitEditMode());
  });

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

  return (
    <AuthProvider>
      <LayoutTopDiv>
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
                <span className="block sm:inline">
                  Could not load config.json
                </span>
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
