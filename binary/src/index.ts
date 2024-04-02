process.env.IS_BINARY = "true";
import { Command } from "commander";
import { getCoreLogsPath } from "core/util/paths";
import fs from "fs";
import { IpcIde } from "./IpcIde";
import { Core } from "./core";
import { IpcMessenger } from "./messenger";

const logFilePath = getCoreLogsPath();
fs.appendFileSync(logFilePath, "[info] Starting Continue core...\n");

const program = new Command();

program.action(() => {
  try {
    const messenger = new IpcMessenger();
    const ide = new IpcIde(messenger);
    // const ide = new FileSystemIde();
    const core = new Core(messenger, ide);

    // setTimeout(() => {
    //   messenger.mock({
    //     messageId: "2fe7823c-10bd-4771-abb5-781f520039ec",
    //     messageType: "loadSubmenuItems",
    //     data: { title: "issue" },
    //   });
    // }, 1000);
  } catch (e) {
    fs.writeFileSync("./error.log", `${new Date().toISOString()} ${e}\n`);
    console.log("Error: ", e);
    process.exit(1);
  }
});

program.parse(process.argv);
