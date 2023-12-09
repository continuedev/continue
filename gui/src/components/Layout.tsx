import {
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscForeground } from ".";
import { newSession } from "../redux/slices/stateSlice";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import { RootStore } from "../redux/store";
import { getFontSize } from "../util";
import HeaderButtonWithText from "./HeaderButtonWithText";
import TextDialog from "./dialogs";
import IndexingProgressBar from "./loaders/IndexingProgressBar";
import ProgressBar from "./loaders/ProgressBar";
import ModelSelect from "./modelSelection/ModelSelect";

// #region Styled Components
const FOOTER_HEIGHT = "1.8em";

const LayoutTopDiv = styled.div`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  scrollbar-base-color: transparent;
  scrollbar-width: thin;

  & * {
    ::-webkit-scrollbar {
      width: 4px;
    }

    ::-webkit-scrollbar:horizontal {
      height: 4px;
    }

    ::-webkit-scrollbar-thumb {
      border-radius: 2px;
    }
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
  background-color: ${secondaryDark};
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
  background-color: ${secondaryDark};
  position: relative;
  margin-left: 8px;
  z-index: 200;
  font-size: ${getFontSize()};
`;

// #endregion

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const dialogMessage = useSelector(
    (state: RootStore) => state.uiState.dialogMessage
  );
  const showDialog = useSelector(
    (state: RootStore) => state.uiState.showDialog
  );
  const indexingProgress = useSelector(
    (state: RootStore) => state.serverState.indexingProgress
  );

  const defaultModel = useSelector(
    (state: RootStore) => (state.serverState.config as any).models?.default
  );
  // #region Selectors

  const bottomMessage = useSelector(
    (state: RootStore) => state.uiState.bottomMessage
  );
  const displayBottomMessageOnBottom = useSelector(
    (state: RootStore) => state.uiState.displayBottomMessageOnBottom
  );

  const timeline = useSelector((state: RootStore) => state.state.history);

  // #endregion

  useEffect(() => {
    if (localStorage.getItem("migrationMessageSeen") !== "true") {
      localStorage.setItem("migrationMessageSeen", "true");
      navigate("/migration");
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyC") {
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

  useEffect(() => {
    // Override the VS Code shortcut so that highlighted but unfocused code isn't added
    const handleKeyDown = (event: any) => {
      if (event.metaKey && event.code === "KeyM") {
        dispatch(newSession());
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handler = (event: any) => {
      if (event.data.type === "addModel") {
        navigate("/models");
      } else if (event.data.type === "openSettings") {
        navigate("/settings");
      } else if (event.data.type === "viewHistory") {
        // Toggle the history page / main page
        if (location.pathname === "/history") {
          navigate("/");
        } else {
          navigate("/history");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [location, navigate]);

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
          <Footer>
            <div className="mr-auto flex gap-2 items-center">
              {localStorage.getItem("ide") === "jetbrains" ||
                localStorage.getItem("hideFeature") === "true" || (
                  <SparklesIcon
                    className="cursor-pointer"
                    onClick={() => {
                      localStorage.setItem("hideFeature", "true");
                    }}
                    onMouseEnter={() => {
                      dispatch(
                        setBottomMessage(
                          "🎁 New Feature: Use ⌘⇧R automatically debug errors in the terminal (you can click the sparkle icon to make it go away)"
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
                )}
              <ModelSelect />
              {indexingProgress >= 1 && // Would take up too much space together with indexing progress
                defaultModel?.class_name === "OpenAIFreeTrial" &&
                defaultModel?.api_key === "" &&
                (location.pathname === "/settings" ||
                  parseInt(localStorage.getItem("ftc") || "0") >= 125) && (
                  <ProgressBar
                    completed={parseInt(localStorage.getItem("ftc") || "0")}
                    total={250}
                  />
                )}

              {indexingProgress < 1 && (
                <IndexingProgressBar
                  completed={indexingProgress * 100}
                  total={100}
                />
              )}
            </div>
            <HeaderButtonWithText
              text="Help"
              onClick={() => {
                navigate("/help");
              }}
            >
              <QuestionMarkCircleIcon width="1.4em" height="1.4em" />
            </HeaderButtonWithText>
            <HeaderButtonWithText
              onClick={() => {
                navigate("/settings");
              }}
              text="Settings"
            >
              <Cog6ToothIcon width="1.4em" height="1.4em" />
            </HeaderButtonWithText>
          </Footer>
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
      <div className="text-sm" id="tooltip-portal-div" />
    </LayoutTopDiv>
  );
};

export default Layout;
