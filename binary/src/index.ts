process.env.IS_BINARY = "true";
import { Command } from "commander";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { IMessenger } from "core/util/messenger";
import { getCoreLogsPath, getPromptLogsPath } from "core/util/paths";
import fs from "node:fs";
import { IpcIde } from "./IpcIde";
import { IpcMessenger } from "./IpcMessenger";
import { setupCoreLogging } from "./logging";
import { TcpMessenger } from "./TcpMessenger";
import { MultiMessenger } from "./MultiMessenger";

const logFilePath = getCoreLogsPath();
fs.appendFileSync(logFilePath, "[info] Starting Continue core...\n");

const program = new Command();

program.action(async () => {
  try {
    let messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;

    const tcpMessenger = new TcpMessenger<ToCoreProtocol, FromCoreProtocol>();
    const ipcMessenger = new IpcMessenger<ToCoreProtocol, FromCoreProtocol>();
    
    messenger = new MultiMessenger<ToCoreProtocol, FromCoreProtocol>([
      ipcMessenger,
      tcpMessenger,
    ]);

    setupCoreLogging();

    const ide = new IpcIde(messenger);
    const promptLogsPath = getPromptLogsPath();
    const core = new Core(messenger, ide, async (text) => {
      fs.appendFileSync(promptLogsPath, text + "\n\n");
    });
  } catch (e) {
    fs.writeFileSync("./error.log", `${new Date().toISOString()} ${e}\n`);
    console.log("Error: ", e);
    process.exit(1);
  }
});

program.parse(process.argv);
