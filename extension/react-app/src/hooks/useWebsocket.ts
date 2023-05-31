import React, { useEffect, useState } from "react";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import ContinueNotebookClientProtocol from "./useContinueNotebookProtocol";
import { postVscMessage } from "../vscode";

function useContinueNotebookProtocol(useVscodeMessagePassing: boolean = false) {
  const sessionId = useSelector((state: RootStore) => state.config.sessionId);
  const serverHttpUrl = useSelector((state: RootStore) => state.config.apiUrl);
  const [client, setClient] = useState<
    ContinueNotebookClientProtocol | undefined
  >(undefined);

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
      "/notebook/ws?session_id=" +
      encodeURIComponent(sessionId);

    console.log("Creating websocket", serverUrlWithSessionId);
    console.log("Using vscode message passing", useVscodeMessagePassing);
    const newClient = new ContinueNotebookClientProtocol(
      serverUrlWithSessionId,
      useVscodeMessagePassing
    );
    setClient(newClient);
  }, [sessionId, serverHttpUrl]);

  return client;
}
export default useContinueNotebookProtocol;
