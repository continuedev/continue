process.env.IS_BINARY = "true";
import { Command } from "commander";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { getCoreLogsPath } from "core/util/paths";
import fs from "node:fs";
import { IpcIde } from "./IpcIde";
import { IpcMessenger } from "./messenger";

const logFilePath = getCoreLogsPath();
fs.appendFileSync(logFilePath, "[info] Starting Continue core...\n");

const program = new Command();

program.action(() => {
  try {
    const messenger = new IpcMessenger<ToCoreProtocol, FromCoreProtocol>();
    const ide = new IpcIde(messenger);
    // const ide = new FileSystemIde(); // for testing
    const core = new Core(messenger, ide);
  } catch (e) {
    fs.writeFileSync("./error.log", `${new Date().toISOString()} ${e}\n`);
    console.log("Error: ", e);
    process.exit(1);
  }
});

program.parse(process.argv);
