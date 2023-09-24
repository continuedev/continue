import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscForeground } from ".";
import { Outlet } from "react-router-dom";
import TextDialog from "./TextDialog";
import { useContext, useEffect } from "react";
import { GUIClientContext } from "../App";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import {
  SparklesIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { useNavigate, useLocation } from "react-router-dom";
import ModelSelect from "./ModelSelect";
import ProgressBar from "./ProgressBar";
import { temporarilyClearSession } from "../redux/slices/serverStateReducer";

// #region Styled Components
const FOOTER_HEIGHT = "1.8em";

const LayoutTopDiv = styled.div`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  scrollbar-base-color: transparent;
  scrollbar-width: thin;
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
  overflow: scroll;
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

  overflow: hidden;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

// #endregion

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
  const dialogMessage = useSelector(
    (state: RootStore) => state.uiState.dialogMessage
  );
  const showDialog = useSelector(
    (state: RootStore) => state.uiState.showDialog
  );

  const defaultModel = useSelector(
    (state: RootStore) =>
      (state.serverState.config as any).models?.default?.class_name
  );
  // #region Selectors

  const bottomMessage = useSelector(
    (state: RootStore) => state.uiState.bottomMessage
  );
  const displayBottomMessageOnBottom = useSelector(
    (state: RootStore) => state.uiState.displayBottomMessageOnBottom
  );

  const timeline = useSelector(
    (state: RootStore) => state.serverState.history.timeline
  );

  // #endregion

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (
        event.metaKey &&
        event.altKey &&
        event.code === "KeyN" &&
        timeline.filter((n) => !n.step.hide).length > 0
      ) {
        dispatch(temporarilyClearSession(false));
        client?.loadSession(undefined);
      }
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
  }, [client, timeline]);

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
          <Footer>
            <div className="mr-auto flex gap-2 items-center">
              {localStorage.getItem("hideFeature") === "true" || (
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
              {defaultModel === "OpenAIFreeTrial" &&
                (location.pathname === "/settings" ||
                  parseInt(localStorage.getItem("ftc") || "0") >= 125) && (
                  <ProgressBar
                    completed={parseInt(localStorage.getItem("ftc") || "0")}
                    total={250}
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
      <div id="tooltip-portal-div" />
    </LayoutTopDiv>
  );
};

export default Layout;
