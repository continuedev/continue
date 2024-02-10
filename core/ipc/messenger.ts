import { v4 as uuidv4 } from "uuid";
import { PersistedSessionInfo } from "..";

export abstract class Messenger {
  abstract send(messageType: string, message: any, messageId?: string): string;
  abstract on(messageType: string, handler: (message: any) => any): void;
}

export interface Message<T = any> {
  messageType: string;
  messageId: string;
  data: T;
}

type Protocol = {
  "history/list": [undefined, PersistedSessionInfo[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, PersistedSessionInfo];
  "history/save": [PersistedSessionInfo, void];
  "devdata/log": [{ tableName: string; data: any }, void];
};
type ProtocolKeys = keyof Protocol;

type ProtocolCallbacks = {
  [K in ProtocolKeys]: (msg: Protocol[K][0]) => Protocol[K][1];
};

export class IpcMessenger extends Messenger {
  listeners = new Map<string, ((message: Message) => any)[]>();

  constructor() {
    super();

    console.log = console.error;

    process.stdin.on("data", (data) => {
      const d = data.toString();
      try {
        const msg: Message = JSON.parse(d);
        if (
          msg.data !== undefined ||
          msg.messageType !== undefined ||
          msg.messageId !== undefined
        ) {
          throw new Error("Invalid message sent: " + JSON.stringify(msg));
        }

        this.listeners.get(msg.messageType)?.forEach(async (handler) => {
          const response = await handler(msg);
          this.send(msg.messageType, response, msg.messageId);
        });
      } catch (e) {
        console.error("Invalid JSON:", d);
        return;
      }
    });
  }

  send(messageType: string, message: any, messageId?: string): string {
    messageId = messageId ?? uuidv4();
    const data: Message = {
      messageType,
      data: message,
      messageId,
    };
    // process.send?.(data);
    process.stdout?.write(JSON.stringify(data));
    return messageId;
  }

  on<T extends keyof Protocol>(
    messageType: T,
    handler: (message: Message<Protocol[T][0]>) => Protocol[T][1]
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }
}
