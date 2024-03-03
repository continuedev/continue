import { v4 as uuidv4 } from "uuid";

import { getCoreLogsPath } from "core/util/paths";
import * as fs from "fs";
import { Message } from "../../core/util/messenger";
import { Protocol } from "./protocol";

export class IpcMessenger {
  typeListeners = new Map<keyof Protocol, ((message: Message) => any)[]>();
  idListeners = new Map<string, (message: Message) => any>();

  constructor() {
    const logger = (message: any, ...optionalParams: any[]) => {
      const logFilePath = getCoreLogsPath();
      const logMessage = `${message} ${optionalParams.join(" ")}\n`;
      fs.appendFileSync(logFilePath, logMessage);
    };
    console.log = logger;
    console.error = logger;
    console.warn = logger;
    console.log("[info] Starting Continue core...");

    process.stdin.on("data", (data) => {
      this._handleData(data);
    });
    process.stdout.on("close", () => {
      fs.writeFileSync("./error.log", `${new Date().toISOString()}\n`);
      console.log("[info] Exiting Continue core...");
      process.exit(1);
    });
    process.stdin.on("close", () => {
      fs.writeFileSync("./error.log", `${new Date().toISOString()}\n`);
      console.log("[info] Exiting Continue core...");
      process.exit(1);
    });
  }

  mock(data: any) {
    const d = JSON.stringify(data);
    this._handleData(Buffer.from(d));
  }

  private _handleLine(line: string) {
    try {
      const msg: Message = JSON.parse(line);
      if (msg.messageType === undefined || msg.messageId === undefined) {
        throw new Error("Invalid message sent: " + JSON.stringify(msg));
      }

      // Call handler and respond with return value
      const listeners = this.typeListeners.get(msg.messageType as any);
      listeners?.forEach(async (handler) => {
        try {
          const response = await handler(msg);
          if (
            response &&
            typeof response[Symbol.asyncIterator] === "function"
          ) {
            for await (const update of response) {
              this.send(msg.messageType, update, msg.messageId);
            }
            this.send(msg.messageType, { done: true }, msg.messageId);
          } else {
            this.send(msg.messageType, response || {}, msg.messageId);
          }
        } catch (e) {
          console.warn(`Error running handler for "${msg.messageType}": `, e);
        }
      });

      // Call handler which is waiting for the response, nothing to return
      this.idListeners.get(msg.messageId)?.(msg);
    } catch (e) {
      console.error("Error parsing line: ", line, e);
      return;
    }
  }

  private _handleData(data: Buffer) {
    const d = data.toString();
    const lines = d.split("\n").filter((line) => line.trim() !== "");
    lines.forEach((line) => this._handleLine(line));
  }

  send(messageType: string, message: any, messageId?: string): string {
    messageId = messageId ?? uuidv4();
    const data: Message = {
      messageType,
      data: message,
      messageId,
    };
    // process.send?.(data);
    process.stdout?.write(JSON.stringify(data) + "\r\n");
    return messageId;
  }

  on<T extends keyof Protocol>(
    messageType: T,
    handler: (message: Message<Protocol[T][0]>) => Protocol[T][1]
  ): void {
    if (!this.typeListeners.has(messageType)) {
      this.typeListeners.set(messageType, []);
    }
    this.typeListeners.get(messageType)?.push(handler);
  }

  invoke<T extends keyof Protocol>(
    messageType: T,
    data: Protocol[T][0]
  ): Protocol[T][1] {
    return this.typeListeners.get(messageType)?.[0]?.({
      messageId: uuidv4(),
      messageType,
      data,
    });
  }

  request(messageType: string, data: any): Promise<any> {
    const messageId = uuidv4();
    return new Promise((resolve) => {
      const handler = (msg: Message) => {
        resolve(msg.data);
        this.idListeners.delete(messageId);
      };
      this.idListeners.set(messageId, handler);
      this.send(messageType, data, messageId);
    });
  }
}
