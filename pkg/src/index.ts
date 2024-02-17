import { Command } from "commander";
import FileSystemIde from "core/util/filesystem";
import fs from "fs";
import { Core } from "./core";
import { IpcMessenger } from "./messenger";

const program = new Command();

program.action(() => {
  try {
    const messenger = new IpcMessenger();
    // const ide = new IpcIde(messenger);
    const ide = new FileSystemIde();
    const core = new Core(messenger, ide);
  } catch (e) {
    fs.writeFileSync("./error.log", `${new Date().toISOString()} ${e}\n`);
    console.log("Error: ", e);
    process.exit(1);
  }
});

program.parse(process.argv);
