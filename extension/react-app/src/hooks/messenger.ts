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
