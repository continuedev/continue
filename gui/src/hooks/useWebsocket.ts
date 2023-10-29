import React, { useEffect, useState } from "react";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import ContinueGUIClientProtocol from "./ContinueGUIClientProtocol";
import { postVscMessage } from "../vscode";

function useContinueGUIProtocol(useVscodeMessagePassing: boolean = true) {
  // if (localStorage.getItem("ide") === "jetbrains") {
  //   useVscodeMessagePassing = false;
  // }

  const serverHttpUrl = useSelector((state: RootStore) => state.config.apiUrl);
  const [client, setClient] = useState<ContinueGUIClientProtocol | undefined>(
    undefined
  );

  useEffect(() => {
    if (!serverHttpUrl) {
      if (useVscodeMessagePassing) {
        postVscMessage("onLoad", {});
      }
    }
  }, [serverHttpUrl]);

  useEffect(() => {
    const serverUrl = (window as any).serverUrl;

    console.log("Creating GUI websocket", serverUrl, useVscodeMessagePassing);
    const newClient = new ContinueGUIClientProtocol(
      serverUrl,
      useVscodeMessagePassing
    );

    newClient.onConnected(() => {
      setClient(newClient);
    });
  }, []);

  return client;
}
export default useContinueGUIProtocol;
