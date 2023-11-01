import React, { useCallback, useEffect, useState } from "react";
import ContinueGUIClientProtocol from "./ContinueGUIClientProtocol";
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

  useEffect(() => {
    const serverUrl = (window as any).serverUrl;
    const windowId = (window as any).windowId;
    if (serverUrl === undefined || serverUrl === null) return;
    if (windowId === undefined || windowId === null) return;

    console.log("Creating GUI websocket", serverUrl, useVscodeMessagePassing);
    const newClient = new ContinueGUIClientProtocol(
      serverUrl,
      useVscodeMessagePassing,
      getSessionState
    );

    newClient.onConnected(() => {
      setClient(newClient);
    });
  }, [(window as any).windowId]);

  return client;
}
export default useContinueGUIProtocol;
