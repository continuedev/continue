import { IProtocol } from "core/protocol";
import { getCoreLogsPath } from "core/util/paths";
import * as fs from "node:fs";
import { InProcessMessenger, type Message } from "../../core/util/messenger";

export class IpcMessenger<
  ToProtocol extends IProtocol,
  FromProtocol extends IProtocol,
> extends InProcessMessenger<ToProtocol, FromProtocol> {
  constructor() {
    super();

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

  protected _send(message: Message) {
    // process.send?.(data);
    process.stdout?.write(`${JSON.stringify(message)}\r\n`);
  }

  private _handleLine(line: string) {
    try {
      const msg: Message = JSON.parse(line);
      this.handleMessage(msg);
    } catch (e) {
      console.error("Error parsing line: ", line, e);
      return;
    }
  }

  private _handleData(data: Buffer) {
    const d = data.toString();
    const lines = d.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
    lines.forEach((line) => this._handleLine(line));
  }
}
