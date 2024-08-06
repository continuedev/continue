import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { IndexingProgressUpdate } from "core";
import { useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  CustomScrollbarDiv,
  defaultBorderRadius,
  vscForeground,
  vscInputBackground,
} from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { shouldBeginOnboarding } from "../pages/onboarding/utils";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import { RootState } from "../redux/store";
import { getFontSize, isMetaEquivalentKeyPressed } from "../util";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../util/freeTrial";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import TextDialog from "./dialogs";
import HeaderButtonWithText from "./HeaderButtonWithText";
import IndexingProgressBar from "./loaders/IndexingProgressBar";
import ProgressBar from "./loaders/ProgressBar";
import PostHogPageView from "./PosthogPageView";
import ProfileSwitcher from "./ProfileSwitcher";

// #region Styled Components
const FOOTER_HEIGHT = "1.8em";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  position: relative;

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

const BottomMessageDiv = styled.div<{ displayOnBottom: boolean }>`
  position: fixed;
  bottom: ${(props) => (props.displayOnBottom ? "50px" : undefined)};
  top: ${(props) => (props.displayOnBottom ? undefined : "50px")};
  left: 0;
  right: 0;
  margin: 8px;
  margin-top: 0;
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  border-radius: ${defaultBorderRadius};
  padding: 12px;
  z-index: 100;
  box-shadow: 0px 0px 2px 0px ${vscForeground};
  max-height: 35vh;
`;

const Footer = styled.footer`
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: right;
  padding: 8px;
  align-items: center;
  width: calc(100% - 16px);
  height: ${FOOTER_HEIGHT};
  background-color: transparent;
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(136, 136, 136, 0.3);
  border-bottom: 1px solid rgba(136, 136, 136, 0.3);
  overflow: hidden;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

const ModelDropdownPortalDiv = styled.div`
  background-color: ${vscInputBackground};
  position: relative;
  margin-left: 8px;
  z-index: 200;
  font-size: ${getFontSize()};
`;

const ProfileDropdownPortalDiv = styled.div`
  background-color: ${vscInputBackground};
  position: relative;
  margin-left: calc(100% - 190px);
  z-index: 200;
  font-size: ${getFontSize() - 2};
`;

// #endregion

const HIDE_FOOTER_ON_PAGES = [
  "/onboarding",
  "/localOnboarding",
  "/apiKeyOnboarding",
];

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const dialogMessage = useSelector(
    (state: RootState) => state.uiState.dialogMessage,
  );
  const showDialog = useSelector(
    (state: RootState) => state.uiState.showDialog,
  );

  const defaultModel = useSelector(defaultModelSelector);
  // #region Selectors

  const bottomMessage = useSelector(
    (state: RootState) => state.uiState.bottomMessage,
  );
  const displayBottomMessageOnBottom = useSelector(
    (state: RootState) => state.uiState.displayBottomMessageOnBottom,
  );

  const timeline = useSelector((state: RootState) => state.state.history);

  // #endregion

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
  }, [timeline]);

  useWebviewListener(
    "addModel",
    async () => {
      navigate("/models");
    },
    [navigate],
  );

  useWebviewListener("openSettings", async () => {
    ideMessenger.post("openConfigJson", undefined);
  });

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

  useWebviewListener("indexProgress", async (data) => {
    setIndexingState(data);
  });

  useWebviewListener(
    "addApiKey",
    async () => {
      navigate("/apiKeyOnboarding");
    },
    [navigate],
  );

  useWebviewListener(
    "openOnboarding",
    async () => {
      navigate("/onboarding");
    },
    [navigate],
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
    "setupLocalModel",
    async () => {
      ideMessenger.post("completeOnboarding", {
        mode: "localAfterFreeTrial",
      });
      navigate("/localOnboarding");
    },
    [navigate],
  );

  useEffect(() => {
    if (
      shouldBeginOnboarding() &&
      (location.pathname === "/" || location.pathname === "/index.html")
    ) {
      navigate("/onboarding");
    }
  }, [location]);

  const [indexingState, setIndexingState] = useState<IndexingProgressUpdate>({
    desc: "Loading indexing config",
    progress: 0.0,
    status: "loading",
  });

  return (
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

        <GridDiv>
          <PostHogPageView />
          <Outlet />
          <ModelDropdownPortalDiv id="model-select-top-div"></ModelDropdownPortalDiv>
          <ProfileDropdownPortalDiv id="profile-select-top-div"></ProfileDropdownPortalDiv>
          {HIDE_FOOTER_ON_PAGES.includes(location.pathname) || (
            <Footer>
              <div className="mr-auto flex flex-grow gap-2 items-center overflow-hidden">
                {indexingState.status !== "indexing" && // Would take up too much space together with indexing progress
                  defaultModel?.provider === "free-trial" && (
                    <ProgressBar
                      completed={parseInt(localStorage.getItem("ftc") || "0")}
                      total={FREE_TRIAL_LIMIT_REQUESTS}
                    />
                  )}
                <IndexingProgressBar indexingState={indexingState} />
              </div>

              <ProfileSwitcher />
              <HeaderButtonWithText
                tooltipPlacement="top-end"
                text="Help"
                onClick={() => {
                  if (location.pathname === "/help") {
                    navigate("/");
                  } else {
                    navigate("/help");
                  }
                }}
              >
                <QuestionMarkCircleIcon width="1.4em" height="1.4em" />
              </HeaderButtonWithText>
            </Footer>
          )}
        </GridDiv>

        <BottomMessageDiv
          displayOnBottom={displayBottomMessageOnBottom}
          onMouseEnter={() => {
            dispatch(setBottomMessageCloseTimeout(undefined));
          }}
          onMouseLeave={(e) => {
            if (!e.buttons) {
              dispatch(setBottomMessage(undefined));
            }
          }}
          hidden={!bottomMessage}
        >
          {bottomMessage}
        </BottomMessageDiv>
      </div>
      <div
        style={{ fontSize: `${getFontSize() - 4}px` }}
        id="tooltip-portal-div"
      />
    </LayoutTopDiv>
  );
};

export default Layout;
