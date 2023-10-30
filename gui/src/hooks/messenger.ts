import socketIOClient, { Socket } from "socket.io-client";
import { v4 } from "uuid";

export abstract class Messenger {
  abstract send(messageType: string, data: object): void;

  abstract onMessageType(
    messageType: string,
    callback: (data: object) => void
  ): void;

  abstract onMessage(callback: (messageType: string, data: any) => void): void;

  abstract onOpen(callback: () => void): void;

  abstract onClose(callback: () => void): void;

  abstract sendAndReceive(messageType: string, data: any): Promise<any>;

  abstract onError(callback: (error: any) => void): void;

  abstract close(): void;
}

export class SocketIOMessenger extends Messenger {
  private socket: Socket;

  constructor(endpoint: string) {
    super();
    console.log(
      "Connecting to socket.io endpoint: ",
      endpoint,
      (window as any).windowId
    );
    this.socket = socketIOClient(
      `${endpoint}?window_id=${(window as any).windowId}`,
      {
        path: "/gui/socket.io",
        transports: ["websocket", "polling", "flashsocket"],
      }
    );
  }

  send(messageType: string, data: object): void {
    console.log("Sending message: ", messageType, data);
    this.socket.emit("message", {
      message_type: messageType,
      data,
      message_id: v4(),
    });
  }

  onMessageType(messageType: string, callback: (data: object) => void): void {
    this.socket.on("message", ({ messageType, data }) => {
      if (messageType === messageType) {
        callback(data);
      }
    });
  }

  onMessage(callback: (messageType: string, data: any) => void): void {
    this.socket.on("message", ({ messageType, data }) => {
      callback(messageType, data);
    });
  }

  onOpen(callback: () => void): void {
    this.socket.on("connect", callback);
  }

  onClose(callback: () => void): void {
    this.socket.on("disconnect", callback);
  }

  async sendAndReceive(messageType: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        "message",
        { message_type: messageType, data, message_id: v4() },
        (response: any) => {
          if (response && response.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  onError(callback: (error: any) => void): void {
    this.socket.on("error", callback);
  }

  close(): void {
    this.socket.disconnect();
  }
}

export class WebsocketMessenger extends Messenger {
  websocket: WebSocket;
  private onMessageListeners: {
    [messageType: string]: ((data: object) => void)[];
  } = {};
  private onErrorListeners: ((error: any) => void)[] = [];
  private onOpenListeners: (() => void)[] = [];
  private onCloseListeners: (() => void)[] = [];
  private serverUrl: string;

  _newWebsocket(): WebSocket {
    const newWebsocket = new WebSocket(this.serverUrl);
    for (const listener of this.onOpenListeners) {
      this.onOpen(listener);
    }
    for (const listener of this.onCloseListeners) {
      this.onClose(listener);
    }
    for (const messageType in this.onMessageListeners) {
      for (const listener of this.onMessageListeners[messageType]) {
        this.onMessageType(messageType, listener);
      }
    }
    for (const listener of this.onErrorListeners) {
      this.onError(listener);
    }
    return newWebsocket;
  }

  constructor(serverUrl: string) {
    super();
    this.serverUrl = serverUrl;
    this.websocket = this._newWebsocket();
  }

  send(messageType: string, data: object) {
    const payload = JSON.stringify({ messageType, data });
    if (this.websocket.readyState === this.websocket.OPEN) {
      this.websocket.send(payload);
    } else {
      if (this.websocket.readyState !== this.websocket.CONNECTING) {
        this.websocket = this._newWebsocket();
      }
      this.websocket.addEventListener("open", () => {
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
      this.websocket.addEventListener("message", (event: any) => {
        const msg = JSON.parse(event.data);
        if (msg.messageType === messageType) {
          eventListener(msg.data);
        }
      });
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
    this.onMessageListeners[messageType] = [
      ...(this.onMessageListeners[messageType] || []),
      callback,
    ];
  }

  onMessage(callback: (messageType: string, data: any) => void): void {
    this.websocket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      callback(msg.messageType, msg.data);
    });
  }

  onOpen(callback: () => void): void {
    this.websocket.addEventListener("open", callback);
    this.onOpenListeners.push(callback);
  }

  onClose(callback: () => void): void {
    this.websocket.addEventListener("close", callback);
    this.onCloseListeners.push(callback);
  }

  onError(callback: (error: any) => void): void {
    this.websocket.addEventListener("error", callback);
    this.onErrorListeners.push(callback);
  }

  close(): void {
    this.websocket.close();
  }
}
