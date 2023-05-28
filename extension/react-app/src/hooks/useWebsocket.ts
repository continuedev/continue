import React, { useEffect, useState } from "react";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import { postVscMessage } from "../vscode";

abstract class Messenger {
  abstract send(data: string): void;
}

class VscodeMessenger extends Messenger {
  url: string;

  constructor(
    url: string,
    onMessage: (message: { data: any }) => void,
    onOpen: (messenger: Messenger) => void,
    onClose: (messenger: Messenger) => void
  ) {
    super();
    this.url = url;
    window.addEventListener("message", (event: any) => {
      switch (event.data.type) {
        case "websocketForwardingMessage":
          onMessage(event.data);
          break;
        case "websocketForwardingOpen":
          onOpen(this);
          break;
        case "websocketForwardingClose":
          onClose(this);
          break;
      }
    });

    postVscMessage("websocketForwardingOpen", { url: this.url });
  }

  send(data: string) {
    postVscMessage("websocketForwardingMessage", {
      message: data,
      url: this.url,
    });
  }
}

class WebsocketMessenger extends Messenger {
  websocket: WebSocket;
  constructor(
    websocket: WebSocket,
    onMessage: (message: { data: any }) => void,
    onOpen: (messenger: Messenger) => void,
    onClose: (messenger: Messenger) => void
  ) {
    super();
    this.websocket = websocket;

    websocket.addEventListener("close", () => {
      onClose(this);
    });

    websocket.addEventListener("open", () => {
      onOpen(this);
    });

    websocket.addEventListener("message", (event) => {
      onMessage(event.data);
    });
  }

  static async connect(
    url: string,
    sessionId: string,
    onMessage: (message: { data: any }) => void,
    onOpen: (messenger: Messenger) => void,
    onClose: (messenger: Messenger) => void
  ): Promise<WebsocketMessenger> {
    const ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      ws.addEventListener("open", () => {
        resolve(new WebsocketMessenger(ws, onMessage, onOpen, onClose));
      });
    });
  }

  send(data: string) {
    this.websocket.send(JSON.stringify(data));
  }
}

function useContinueWebsocket(
  serverUrl: string,
  onMessage: (message: { data: any }) => void,
  useVscodeMessagePassing: boolean = true
) {
  const sessionId = useSelector((state: RootStore) => state.config.sessionId);
  const [websocket, setWebsocket] = useState<Messenger | undefined>(undefined);

  async function connect() {
    while (!sessionId) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log("Creating websocket", sessionId);
    console.log("Using vscode message passing", useVscodeMessagePassing);

    const onClose = (messenger: Messenger) => {
      console.log("Websocket closed");
      setWebsocket(undefined);
    };

    const onOpen = (messenger: Messenger) => {
      console.log("Websocket opened");
      messenger.send(JSON.stringify({ sessionId }));
    };

    const url =
      serverUrl.replace("http", "ws") +
      "/notebook/ws?session_id=" +
      encodeURIComponent(sessionId);

    const messenger: Messenger = useVscodeMessagePassing
      ? new VscodeMessenger(url, onMessage, onOpen, onClose)
      : await WebsocketMessenger.connect(
          url,
          sessionId,
          onMessage,
          onOpen,
          onClose
        );

    setWebsocket(messenger);

    return messenger;
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
