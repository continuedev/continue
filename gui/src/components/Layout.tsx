import { useContext, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv, defaultBorderRadius, vscInputBackground } from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { LastSessionProvider } from "../context/LastSessionContext";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useConfigError } from "../redux/hooks";
import {
  setEditDone,
  setEditStatus,
  addCodeToEdit,
  focusEdit,
  clearCodeToEdit,
} from "../redux/slices/editModeState";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiStateSlice";
import {
  updateApplyState,
  updateCurCheckpoint,
} from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";
import { getFontSize, isMetaEquivalentKeyPressed } from "../util";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import { ROUTES } from "../util/navigation";
import TextDialog from "./dialogs";
import Footer from "./Footer";
import { isNewUserOnboarding, useOnboardingCard } from "./OnboardingCard";
import PostHogPageView from "./PosthogPageView";
import AccountDialog from "./AccountDialog";
import { AuthProvider } from "../context/Auth";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  position: relative;
  overflow-x: hidden;

  &::after {
    position: absolute;
    content: "";
    width: 100%;
    height: 1px;
    background-color: rgba(136, 136, 136, 0.3);
    top: 0;
    left: 0;
  }
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
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const onboardingCard = useOnboardingCard();
  const { pathname } = useLocation();

  const configError = useConfigError();

  const hasFatalErrors = useMemo(() => {
    return configError?.some((error) => error.fatal);
  }, [configError]);

  const dialogMessage = useSelector(
    (state: RootState) => state.uiState.dialogMessage,
  );
  const showDialog = useSelector(
    (state: RootState) => state.uiState.showDialog,
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
      const u = getLocalStorage("ftc");
      if (u) {
        setLocalStorage("ftc", u + 1);
      } else {
        setLocalStorage("ftc", 1);
      }
    },
    [],
  );

  useWebviewListener(
    "updateApplyState",
    async (state) => {
      dispatch(
        updateCurCheckpoint({
          filepath: state.filepath,
          content: state.fileContent,
        }),
      );
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
      dispatch(focusEdit());
      dispatch(clearCodeToEdit());
      navigate("/edit");
    },
    [navigate],
  );

  useWebviewListener(
    "focusEditWithoutClear",
    async () => {
      dispatch(focusEdit());
      navigate("/edit");
    },
    [navigate],
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

  useWebviewListener(
    "exitEditMode",
    async () => {
      dispatch(setEditDone());
      navigate("/");
    },
    [navigate],
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

  return (
    <AuthProvider>
      <LastSessionProvider>
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
      </LastSessionProvider>
    </AuthProvider>
  );
};

export default Layout;
