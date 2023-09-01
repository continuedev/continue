import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscForeground } from ".";
import { Outlet } from "react-router-dom";
import Onboarding from "./Onboarding";
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
  PlusIcon,
  FolderIcon,
  BookOpenIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  SparklesIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { useNavigate } from "react-router-dom";
import ModelSelect from "./ModelSelect";

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
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
`;

// #endregion

const Layout = () => {
  const navigate = useNavigate();
  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
  const dialogMessage = useSelector(
    (state: RootStore) => state.uiState.dialogMessage
  );
  const showDialog = useSelector(
    (state: RootStore) => state.uiState.showDialog
  );
  const dialogEntryOn = useSelector(
    (state: RootStore) => state.uiState.dialogEntryOn
  );

  // #region Selectors

  const bottomMessage = useSelector(
    (state: RootStore) => state.uiState.bottomMessage
  );
  const displayBottomMessageOnBottom = useSelector(
    (state: RootStore) => state.uiState.displayBottomMessageOnBottom
  );

  // #endregion

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.metaKey && event.altKey && event.code === "KeyN") {
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
  }, [client]);

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
        <Onboarding />
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
          <div style={{ overflow: "scroll" }}>
            <Outlet />
          </div>
          <Footer>
            {localStorage.getItem("hideFeature") === "true" || (
              <SparklesIcon
                className="mr-auto cursor-pointer"
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
                  dispatch(setBottomMessage(undefined));
                }}
                width="1.3em"
                height="1.3em"
                color="yellow"
              />
            )}

            <ModelSelect />
            <HeaderButtonWithText
              onClick={() => {
                client?.loadSession(undefined);
              }}
              text="New Session (⌥⌘N)"
            >
              <PlusIcon width="1.4em" height="1.4em" />
            </HeaderButtonWithText>
            <HeaderButtonWithText
              onClick={() => {
                navigate("/history");
              }}
              text="History"
            >
              <FolderIcon width="1.4em" height="1.4em" />
            </HeaderButtonWithText>
            <a
              href="https://continue.dev/docs/how-to-use-continue"
              className="no-underline"
            >
              <HeaderButtonWithText text="Docs">
                <BookOpenIcon width="1.4em" height="1.4em" />
              </HeaderButtonWithText>
            </a>
            <a
              href="https://github.com/continuedev/continue/issues/new/choose"
              className="no-underline"
            >
              <HeaderButtonWithText text="Feedback">
                <ChatBubbleOvalLeftEllipsisIcon width="1.4em" height="1.4em" />
              </HeaderButtonWithText>
            </a>
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
    </LayoutTopDiv>
  );
};

export default Layout;
