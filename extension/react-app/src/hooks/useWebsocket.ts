import React, { useEffect, useState } from "react";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";

function useContinueWebsocket(
  serverUrl: string,
  onMessage: (message: { data: any }) => void
) {
  const sessionId = useSelector((state: RootStore) => state.config.sessionId);
  const [websocket, setWebsocket] = useState<WebSocket | undefined>(undefined);

  async function connect() {
    while (!sessionId) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log("Creating websocket", sessionId);

    const wsUrl =
      serverUrl.replace("http", "ws") +
      "/notebook/ws?session_id=" +
      encodeURIComponent(sessionId);

    const ws = new WebSocket(wsUrl);
    setWebsocket(ws);

    // Set up callbacks
    ws.onopen = () => {
      console.log("Websocket opened");
      ws.send(JSON.stringify({ sessionId }));
    };

    ws.onmessage = (msg) => {
      onMessage(msg);
      console.log("Got message", msg);
    };

    ws.onclose = (msg) => {
      console.log("Websocket closed");
      setWebsocket(undefined);
    };

    return ws;
  }

  async function getConnection() {
    if (!websocket) {
      return await connect();
    }
    return websocket;
  }

  async function send(message: object) {
    let ws = await getConnection();
    ws.send(JSON.stringify(message));
  }

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    connect();
  }, [sessionId]);

  return { send };
}
export default useContinueWebsocket;
