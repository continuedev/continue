import React, { useEffect, useState } from "react";
import ContinueGUIClientProtocol from "./ContinueGUIClientProtocol";

function useContinueGUIProtocol(useVscodeMessagePassing: boolean = true) {
  // if (localStorage.getItem("ide") === "jetbrains") {
  //   useVscodeMessagePassing = false;
  // }

  const [client, setClient] = useState<ContinueGUIClientProtocol | undefined>(
    undefined
  );

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
