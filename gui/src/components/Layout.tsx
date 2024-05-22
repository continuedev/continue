import {
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { IndexingProgressUpdate } from "core";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  CustomScrollbarDiv,
  defaultBorderRadius,
  vscForeground,
  vscInputBackground,
} from ".";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import { RootState } from "../redux/store";
import { getFontSize, isMetaEquivalentKeyPressed } from "../util";
import { isJetBrains, postToIde } from "../util/ide";
import { getLocalStorage } from "../util/localStorage";
import HeaderButtonWithText from "./HeaderButtonWithText";
import TextDialog from "./dialogs";
import { ftl } from "./dialogs/FTCDialog";
import IndexingProgressBar from "./loaders/IndexingProgressBar";
import ProgressBar from "./loaders/ProgressBar";
import ModelSelect from "./modelSelection/ModelSelect";

// #region Styled Components
const FOOTER_HEIGHT = "1.8em";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  border-radius: ${defaultBorderRadius};
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

  overflow: hidden;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

const DropdownPortalDiv = styled.div`
  background-color: ${vscInputBackground};
  position: relative;
  margin-left: 8px;
  z-index: 200;
  font-size: ${getFontSize()};
`;

// #endregion

const HIDE_FOOTER_ON_PAGES = [
  "/onboarding",
  "/existingUserOnboarding",
  "/localOnboarding",
];

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
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
    postToIde("openConfigJson", undefined);
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
      navigate("/modelconfig/openai");
    },
    [navigate],
  );

  useWebviewListener(
    "setupLocalModel",
    async () => {
      postToIde("completeOnboarding", {
        mode: "localAfterFreeTrial",
      });
      navigate("/localOnboarding");
    },
    [navigate],
  );

  useEffect(() => {
    if (isJetBrains()) {
      return;
    }
    const onboardingComplete = getLocalStorage("onboardingComplete");
    if (
      !onboardingComplete &&
      !location.pathname.startsWith("/onboarding") &&
      !location.pathname.startsWith("/existingUserOnboarding")
    ) {
      if (getLocalStorage("mainTextEntryCounter")) {
        navigate("/existingUserOnboarding");
      } else {
        navigate("/onboarding");
      }
    }
  }, [location]);

  const [indexingState, setIndexingState] = useState<IndexingProgressUpdate>({
    desc: "Indexing disabled",
    progress: 0.0,
    status: "disabled",
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
          <Outlet />
          <DropdownPortalDiv id="model-select-top-div"></DropdownPortalDiv>
          {HIDE_FOOTER_ON_PAGES.includes(location.pathname) || (
            <Footer>
              <div className="mr-auto flex gap-2 items-center">
                {/* {localStorage.getItem("ide") === "jetbrains" ||
                localStorage.getItem("hideFeature") === "true" || (
                  <SparklesIcon
                    className="cursor-pointer"
                    onClick={() => {
                      localStorage.setItem("hideFeature", "true");
                    }}
                    onMouseEnter={() => {
                      dispatch(
                        setBottomMessage(
                          `🎁 New Feature: Use ${getMetaKeyLabel()}⇧R automatically debug errors in the terminal (you can click the sparkle icon to make it go away)`
                        )
                      );
                    }}
                    onMouseLeave={() => {
                      dispatch(
                        setBottomMessageCloseTimeout(
                          setTimeout(() => {
                            dispatch(setBottomMessage(undefined));
                          }, 2000)
                        )
                      );
                    }}
                    width="1.3em"
                    height="1.3em"
                    color="yellow"
                  />
                )} */}
                <ModelSelect />
                {indexingState.status !== "indexing" && // Would take up too much space together with indexing progress
                  defaultModel?.provider === "free-trial" && (
                    <ProgressBar
                      completed={parseInt(localStorage.getItem("ftc") || "0")}
                      total={ftl()}
                    />
                  )}

                {isJetBrains() || (
                  <IndexingProgressBar indexingState={indexingState} />
                )}
              </div>
              <HeaderButtonWithText
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
              <HeaderButtonWithText
                onClick={() => {
                  // navigate("/settings");
                  postToIde("openConfigJson", undefined);
                }}
                text="Configure Continue"
              >
                <Cog6ToothIcon width="1.4em" height="1.4em" />
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
