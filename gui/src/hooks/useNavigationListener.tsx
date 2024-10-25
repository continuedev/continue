import type { ToWebviewProtocol } from "core/protocol";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useWebviewListener } from "./useWebviewListener";

const openGUITypes: (keyof ToWebviewProtocol)[] = [
  "highlightedCode",
  "newSessionWithPrompt",
  "focusContinueInput",
  "focusContinueInputWithoutClear",
  "newSession",
];

export const useNavigationListener = () => {
  const navigate = useNavigate();

  for (const messageType of openGUITypes) {
    useWebviewListener(
      messageType,
      async (data) => {
        navigate("/");
        setTimeout(() => {
          window.postMessage(
            {
              messageType,
              data,
              messageId: uuidv4(),
            },
            "*",
          );
        }, 200);
      },
      [navigate],
    );
  }
};
