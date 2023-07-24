import React, { useEffect, useState } from "react";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import ContinueGUIClientProtocol from "./ContinueGUIClientProtocol";
import { postVscMessage } from "../vscode";

function useContinueGUIProtocol(useVscodeMessagePassing: boolean = true) {
  const sessionId = useSelector((state: RootStore) => state.config.sessionId);
  const serverHttpUrl = useSelector((state: RootStore) => state.config.apiUrl);
  const [client, setClient] = useState<ContinueGUIClientProtocol | undefined>(
    undefined
  );

  useEffect(() => {
    if (!sessionId || !serverHttpUrl) {
      if (useVscodeMessagePassing) {
        postVscMessage("onLoad", {});
      }
      setClient(undefined);
      return;
    }

    const serverUrlWithSessionId =
      serverHttpUrl.replace("http", "ws") +
      "/gui/ws?session_id=" +
      encodeURIComponent(sessionId);

    console.log("Creating websocket", serverUrlWithSessionId);
    console.log("Using vscode message passing", useVscodeMessagePassing);
    const newClient = new ContinueGUIClientProtocol(
      serverUrlWithSessionId,
      useVscodeMessagePassing
    );
    setClient(newClient);
  }, [sessionId, serverHttpUrl]);

  return client;
}
export default useContinueGUIProtocol;
