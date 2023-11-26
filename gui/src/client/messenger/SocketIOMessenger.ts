import socketIOClient, { Socket } from "socket.io-client";
import { v4 } from "uuid";
import { Messenger } from ".";

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
        reconnectionDelayMax: 1000,
      }
    );
  }

  send(messageType: string, data: object): void {
    this.socket.emit("message", {
      message_type: messageType,
      data,
      message_id: v4(),
    });
  }

  ackWithMessageMetadata(
    ack: (data: any) => void,
    messageId: string,
    messageType: string
  ): (data: any) => void {
    return (data: any) => {
      ack({ message_id: messageId, message_type: messageType, data });
    };
  }

  onMessageType(
    messageType: string,
    callback: (data: object, acknowledge?: (data: any) => void) => void
  ): void {
    this.socket.on("message", ({ message_type, data }, ack) => {
      if (messageType === message_type) {
        callback(data, this.ackWithMessageMetadata(ack, "lolidk", messageType));
      }
    });
  }

  onMessage(
    callback: (
      messageType: string,
      data: any,
      acknowledge?: (data: any) => void
    ) => void
  ): void {
    this.socket.on("message", ({ message_type, data }, ack) => {
      callback(
        message_type,
        data,
        this.ackWithMessageMetadata(ack, "lolidk", message_type)
      );
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
