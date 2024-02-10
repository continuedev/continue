import { v4 as uuidv4 } from "uuid";

export abstract class Messenger {
  abstract send(messageType: string, message: any, messageId?: string): string;
  abstract onMessage(
    messageType: string,
    handler: (message: any) => Promise<any> | undefined
  ): void;
}

export interface Message {
  messageType: string;
  messageId: string;
  message: any;
}

export class IpcMessenger extends Messenger {
  listeners = new Map<
    string,
    ((message: Message) => Promise<any> | undefined)[]
  >();

  constructor() {
    super();

    console.log = console.error;

    process.stdin.on("data", (data) => {
      const d = data.toString();
      try {
        const msg: Message = JSON.parse(d);
        if (
          msg.message !== undefined ||
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
      message,
      messageId,
    };
    // process.send?.(data);
    process.stdout?.write(JSON.stringify(data));
    return messageId;
  }

  onMessage(
    messageType: string,
    handler: (message: Message) => Promise<any> | undefined
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }
}
