import { IProtocol } from "core/protocol/index.js";
import { IMessenger, type Message } from "core/protocol/messenger";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import net from "node:net";
import { v4 as uuidv4 } from "uuid";

class IPCMessengerBase<
  ToProtocol extends IProtocol,
  FromProtocol extends IProtocol,
> implements IMessenger<ToProtocol, FromProtocol>
{
  _sendMsg(message: Message) {
    throw new Error("Not implemented");
  }

  typeListeners = new Map<keyof ToProtocol, ((message: Message) => any)[]>();
  idListeners = new Map<string, (message: Message) => any>();

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
            let next = await response.next();
            while (!next.done) {
              this.send(
                msg.messageType,
                {
                  done: false,
                  content: next.value,
                  status: "success",
                },
                msg.messageId,
              );
              next = await response.next();
            }
            this.send(
              msg.messageType,
              {
                done: true,
                content: next.value,
                status: "success",
              },
              msg.messageId,
            );
          } else {
            this.send(
              msg.messageType,
              {
                done: true,
                content: response,
                status: "success",
              },
              msg.messageId,
            );
          }
        } catch (e: any) {
          this.send(
            msg.messageType,
            { done: true, error: e.message, status: "error" },
            msg.messageId,
          );

          console.warn(`Error running handler for "${msg.messageType}": `, e);
          this._onErrorHandlers.forEach((handler) => {
            handler(msg, e);
          });
        }
      });

      // Call handler which is waiting for the response, nothing to return
      this.idListeners.get(msg.messageId)?.(msg);
    } catch (e) {
      let truncatedLine = line;
      if (line.length > 200) {
        truncatedLine =
          line.substring(0, 100) + "..." + line.substring(line.length - 100);
      }
      console.error("Error parsing line: ", truncatedLine, e);
      return;
    }
  }

  private _unfinishedLine: string | undefined = undefined;

  protected _handleData(data: Buffer) {
    const d = data.toString();
    const lines = d.split(/\r\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) {
      return;
    }

    if (this._unfinishedLine) {
      lines[0] = this._unfinishedLine + lines[0];
      this._unfinishedLine = undefined;
    }
    if (!d.endsWith("\r\n")) {
      this._unfinishedLine = lines.pop();
    }
    lines.forEach((line) => this._handleLine(line));
  }

  private _onErrorHandlers: ((message: Message, error: Error) => void)[] = [];

  onError(handler: (message: Message, error: Error) => void) {
    this._onErrorHandlers.push(handler);
  }

  request<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
  ): Promise<FromProtocol[T][1]> {
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

  mock(data: any) {
    const d = JSON.stringify(data);
    this._handleData(Buffer.from(d));
  }

  send<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
    messageId?: string,
  ): string {
    messageId = messageId ?? uuidv4();
    const msg: Message = {
      messageType: messageType as string,
      data,
      messageId,
    };
    this._sendMsg(msg);
    return messageId;
  }

  invoke<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
  ): ToProtocol[T][1] {
    return this.typeListeners.get(messageType)?.[0]?.({
      messageId: uuidv4(),
      messageType: messageType as string,
      data,
    });
  }

  on<T extends keyof ToProtocol>(
    messageType: T,
    handler: (
      message: Message<ToProtocol[T][0]>,
    ) => Promise<ToProtocol[T][1]> | ToProtocol[T][1],
  ): void {
    if (!this.typeListeners.has(messageType)) {
      this.typeListeners.set(messageType, []);
    }
    this.typeListeners.get(messageType)?.push(handler);
  }
}

export class IpcMessenger<
    ToProtocol extends IProtocol,
    FromProtocol extends IProtocol,
  >
  extends IPCMessengerBase<ToProtocol, FromProtocol>
  implements IMessenger<ToProtocol, FromProtocol>
{
  constructor() {
    super();
    console.log("Setup");
    process.stdin.on("data", (data) => {
      // console.log("[info] Received data: ", data.toString());
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

  _sendMsg(msg: Message) {
    const d = JSON.stringify(msg);
    // console.log("[info] Sending message: ", d);
    process.stdout?.write(d + "\r\n");
  }
}

export class CoreBinaryMessenger<
    ToProtocol extends IProtocol,
    FromProtocol extends IProtocol,
  >
  extends IPCMessengerBase<ToProtocol, FromProtocol>
  implements IMessenger<ToProtocol, FromProtocol>
{
  private errorHandler: (message: Message, error: Error) => void = () => {};
  private messageHandlers: Map<
    keyof ToProtocol,
    (message: Message<any>) => Promise<any> | any
  > = new Map();

  constructor(private readonly subprocess: ChildProcessWithoutNullStreams) {
    super();
    console.log("Setup");
    this.subprocess.stdout.on("data", (data) => {
      console.log("[info] Received data from core:", data.toString() + "\n");
      this._handleData(data);
    });
    this.subprocess.stdout.on("close", () => {
      console.log("[info] Continue core exited");
    });
    this.subprocess.stdin.on("close", () => {
      console.log("[info] Continue core exited");
    });
  }

  _sendMsg(msg: Message) {
    console.log("[info] Sending message to core:", msg);
    const d = JSON.stringify(msg);
    this.subprocess.stdin.write(d + "\r\n");
  }
}

export class CoreBinaryTcpMessenger<
    ToProtocol extends IProtocol,
    FromProtocol extends IProtocol,
  >
  extends IPCMessengerBase<ToProtocol, FromProtocol>
  implements IMessenger<ToProtocol, FromProtocol>
{
  private port: number = 3000;
  private socket: net.Socket | null = null;

  typeListeners = new Map<keyof ToProtocol, ((message: Message) => any)[]>();
  idListeners = new Map<string, (message: Message) => any>();

  constructor() {
    super();
    const socket = net.createConnection(this.port, "localhost");

    this.socket = socket;
    socket.on("data", (data: Buffer) => {
      // console.log("[info] Received data from core:", data.toString() + "\n");
      this._handleData(data);
    });

    socket.on("end", () => {
      console.log("Disconnected from server");
    });

    socket.on("error", (err: any) => {
      console.error("Client error:", err);
    });
  }

  close() {
    this.socket?.end();
  }

  _sendMsg(msg: Message) {
    if (this.socket) {
      // console.log("[info] Sending message to core:", msg);
      const d = JSON.stringify(msg);
      this.socket.write(d + "\r\n");
    } else {
      console.error("Socket is not connected");
    }
  }
}
