import { postVscMessage } from "../vscode";
// import { Messenger } from "../../../src/util/messenger";
import { Messenger } from "./messenger";

export class VscodeMessenger extends Messenger {
  serverUrl: string;

  constructor(serverUrl: string) {
    super();
    this.serverUrl = serverUrl;
    postVscMessage("websocketForwardingOpen", { url: this.serverUrl });
  }

  send(messageType: string, data: object) {
    postVscMessage("websocketForwardingMessage", {
      message: { messageType, data },
      url: this.serverUrl,
    });
  }

  onMessageType(messageType: string, callback: (data: object) => void): void {
    window.addEventListener("message", (event: any) => {
      if (event.data.type === "websocketForwardingMessage") {
        const data = JSON.parse(event.data.data);
        if (data.messageType === messageType) {
          callback(data.data);
        }
      }
    });
  }

  onMessage(callback: (messageType: string, data: any) => void): void {
    window.addEventListener("message", (event: any) => {
      if (event.data.type === "websocketForwardingMessage") {
        const data = JSON.parse(event.data.data);
        callback(data.messageType, data.data);
      }
    });
  }

  onError(callback: (error: any) => void): void {
    window.addEventListener("message", (event: any) => {
      if (event.data.type === "websocketForwardingError") {
        callback(event.data.error);
      }
    });
  }

  sendAndReceive(messageType: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      const handler = (event: any) => {
        if (event.data.type === "websocketForwardingMessage") {
          const data = JSON.parse(event.data.data);
          if (data.messageType === messageType) {
            window.removeEventListener("message", handler);
            resolve(data.data);
          }
        }
      };
      window.addEventListener("message", handler);
      this.send(messageType, data);
    });
  }

  onOpen(callback: () => void): void {
    window.addEventListener("message", (event: any) => {
      if (event.data.type === "websocketForwardingOpen") {
        callback();
      }
    });
  }
  onClose(callback: () => void): void {
    window.addEventListener("message", (event: any) => {
      if (event.data.type === "websocketForwardingClose") {
        callback();
      }
    });
  }
}
