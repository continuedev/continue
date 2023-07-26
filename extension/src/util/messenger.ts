console.log("Websocket import");
const WebSocket = require("ws");
import fetch from "node-fetch";

export abstract class Messenger {
  abstract send(messageType: string, data: object): void;

  abstract onMessageType(
    messageType: string,
    callback: (data: object) => void
  ): void;

  abstract onMessage(callback: (messageType: string, data: any) => void): void;

  abstract onOpen(callback: () => void): void;

  abstract onClose(callback: () => void): void;

  abstract onError(callback: () => void): void;

  abstract sendAndReceive(messageType: string, data: any): Promise<any>;
}

export class WebsocketMessenger extends Messenger {
  websocket: WebSocket;
  private onMessageListeners: {
    [messageType: string]: ((data: object) => void)[];
  } = {};
  private onOpenListeners: (() => void)[] = [];
  private onCloseListeners: (() => void)[] = [];
  private onErrorListeners: (() => void)[] = [];
  private serverUrl: string;

  _newWebsocket(): WebSocket {
    // // Dynamic import, because WebSocket is builtin with browser, but not with node. And can't use require in browser.
    // if (typeof process === "object") {
    //   console.log("Using node");
    //   // process is only available in Node
    //   var WebSocket = require("ws");
    // }

    console.log("Creating websocket at: ", this.serverUrl);
    const newWebsocket = new WebSocket(this.serverUrl);
    for (const listener of this.onOpenListeners) {
      this.onOpen(listener);
    }
    for (const listener of this.onCloseListeners) {
      this.onClose(listener);
    }
    for (const listener of this.onErrorListeners) {
      this.onError(listener);
    }
    for (const messageType in this.onMessageListeners) {
      for (const listener of this.onMessageListeners[messageType]) {
        this.onMessageType(messageType, listener);
      }
    }
    return newWebsocket;
  }

  async checkServerRunning(serverUrl: string): Promise<boolean> {
    // Check if already running by calling /health
    try {
      const response = await fetch(serverUrl + "/health");
      if (response.status === 200) {
        console.log("Continue python server already running");
        return true;
      } else {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  constructor(serverUrl: string) {
    super();
    this.serverUrl = serverUrl;
    this.websocket = this._newWebsocket();

    // Wait until the server is running
    // const interval = setInterval(async () => {
    //   if (
    //     await this.checkServerRunning(
    //       serverUrl.replace("/ide/ws", "").replace("ws://", "http://")
    //     )
    //   ) {
    //     this.websocket = this._newWebsocket();
    //     clearInterval(interval);
    //   } else {
    //     console.log(
    //       "Waiting for python server to start-----------------------"
    //     );
    //   }
    // }, 1000);

    // const interval = setInterval(() => {
    //   if (this.websocket.readyState === this.websocket.OPEN) {
    //     clearInterval(interval);
    //   } else if (this.websocket.readyState !== this.websocket.CONNECTING) {
    //     this.websocket = this._newWebsocket();
    //   }
    // }, 1000);
  }

  send(messageType: string, data: object) {
    const payload = JSON.stringify({ messageType, data });
    if (this.websocket.readyState === this.websocket.OPEN) {
      console.log("websocket is open, sending message: ", messageType);
      this.websocket.send(payload);
    } else {
      console.log("websocket is not open, creating new websocket", messageType);
      this.websocket = this._newWebsocket();

      this.websocket.addEventListener("open", () => {
        console.log("websocket is open, resending message: ", messageType);
        this.websocket.send(payload);
      });
    }
  }

  sendAndReceive(messageType: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const eventListener = (data: any) => {
        // THIS ISN"T GETTING CALLED
        resolve(data);
        this.websocket.removeEventListener("message", eventListener);
      };
      this.onMessageType(messageType, eventListener);
      this.send(messageType, data);
    });
  }

  onMessageType(messageType: string, callback: (data: any) => void): void {
    this.websocket.addEventListener("message", (event: any) => {
      const msg = JSON.parse(event.data);
      if (msg.messageType === messageType) {
        callback(msg.data);
      }
    });
  }

  onMessage(
    callback: (
      messageType: string,
      data: any,
      messenger: WebsocketMessenger
    ) => void
  ): void {
    this.websocket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      callback(msg.messageType, msg.data, this);
    });
  }

  onOpen(callback: () => void): void {
    this.websocket.addEventListener("open", callback);
  }

  onClose(callback: () => void): void {
    this.websocket.addEventListener("close", callback);
  }

  onError(callback: () => void): void {
    this.websocket.addEventListener("error", callback);
  }
}
