import { ReverseWebviewProtocol } from "core/web/webviewProtocol";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useWebviewListener } from "./useWebviewListener";

const openGUITypes: (keyof ReverseWebviewProtocol)[] = [
  "highlightedCode",
  "newSessionWithPrompt",
  "focusContinueInput",
  "focusContinueInputWithoutClear",
  "newSession",
];

export const useNavigationListener = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
            "*"
          );
        }, 200);
      },
      [navigate]
    );
  }

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
    [location, navigate]
  );
};
