import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscForeground } from ".";
import { Outlet } from "react-router-dom";
import Onboarding from "./Onboarding";
import TextDialog from "./TextDialog";
import { useContext } from "react";
import { GUIClientContext } from "../App";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setDialogEntryOn,
  setDialogMessage,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import {
  PlusIcon,
  FolderIcon,
  BookOpenIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { useNavigate } from "react-router-dom";

// #region Styled Components

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
  max-height: 50vh;
  overflow: scroll;
`;

const Footer = styled.footer`
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: right;
  padding: 8px;
  align-items: center;
  margin-top: 8px;
  border-top: 0.1px solid gray;
`;

// #endregion

const Layout = () => {
  const navigate = useNavigate();
  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
  const { showDialog, dialogEntryOn, dialogMessage } = useSelector(
    (state: RootStore) => state.uiState
  );

  // #region Selectors
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  const { bottomMessage, displayBottomMessageOnBottom } = useSelector(
    (state: RootStore) => state.uiState
  );

  // #endregion

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
          onEnter={(text) => {
            client?.sendMainInput(`/feedback ${text}`);
            dispatch(setShowDialog(false));
          }}
          onClose={() => {
            dispatch(setShowDialog(false));
          }}
          message={dialogMessage}
          entryOn={dialogEntryOn}
        />
        <Outlet />

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
        <Footer>
          {vscMediaUrl && (
            <a
              href="https://github.com/continuedev/continue"
              style={{ marginRight: "auto" }}
            >
              <img
                src={`${vscMediaUrl}/continue-dev-square.png`}
                width="22px"
                style={{ backgroundColor: "black", color: "red" }}
              />
            </a>
          )}
          <HeaderButtonWithText
            onClick={() => {
              // Show the dialog
              dispatch(
                setDialogMessage(`Continue uses GPT-4 by default, but works with any model. If you'd like to keep your code completely private, there are few options:
  
  Run a local model with ggml: [5 minute quickstart](https://github.com/continuedev/ggml-server-example)
  
  Use Azure OpenAI service, which is GDPR and HIPAA compliant: [Tutorial](https://continue.dev/docs/customization#azure-openai-service)
  
  If you already have an LLM deployed on your own infrastructure, or would like to do so, please contact us at hi@continue.dev.
              `)
              );
              dispatch(setDialogEntryOn(false));
              dispatch(setShowDialog(true));
            }}
            text={"Use Private Model"}
          >
            <div
              style={{
                fontSize: "18px",
                marginLeft: "2px",
                marginRight: "2px",
              }}
            >
              🔒
            </div>
          </HeaderButtonWithText>
          <HeaderButtonWithText
            onClick={() => {
              client?.loadSession(undefined);
            }}
            text="New Session"
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
          <HeaderButtonWithText
            onClick={() => {
              // Set dialog open
              dispatch(
                setDialogMessage(
                  "Having trouble using Continue? Want a new feature? Let us know! This box is anonymous, but we will promptly address your feedback."
                )
              );
              dispatch(setDialogEntryOn(true));
              dispatch(setShowDialog(true));
            }}
            text="Feedback"
          >
            <ChatBubbleOvalLeftEllipsisIcon width="1.4em" height="1.4em" />
          </HeaderButtonWithText>
        </Footer>
      </div>
    </LayoutTopDiv>
  );
};

export default Layout;
