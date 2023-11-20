import React, { useCallback, useEffect, useState } from "react";
import ContinueGUIClientProtocol from "../client/ContinueGUIClientProtocol";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

function useContinueGUIProtocol(useVscodeMessagePassing: boolean = true) {
  // if (localStorage.getItem("ide") === "jetbrains") {
  //   useVscodeMessagePassing = false;
  // }

  const [client, setClient] = useState<ContinueGUIClientProtocol | undefined>(
    undefined
  );

  const sessionState = useSelector((store: RootStore) => store.sessionState);

  const getSessionState = () => {
    return {
      history: sessionState.history,
      context_items: sessionState.context_items,
    };
  };

  useEffect(() => {
    if (!client) return;
    client.getSessionState = getSessionState;
  }, [sessionState]);

  const load = () => {
    const windowAny = window as any;
    const serverUrl = windowAny.serverUrl;
    const windowId = windowAny.windowId;
    if (serverUrl === undefined || serverUrl === null) return false;
    if (windowId === undefined || windowId === null) return false;

    const newClient = new ContinueGUIClientProtocol(
      serverUrl,
      useVscodeMessagePassing,
      getSessionState
    );

    newClient.onConnected(() => {
      setClient(newClient);
    });

    return true;
  };
  useEffect(() => {
    // Because sometimes window.... aren't set immediately, but they can't be used as useEffect dependencies
    const interval = setInterval(() => {
      if (load()) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return client;
}
export default useContinueGUIProtocol;
