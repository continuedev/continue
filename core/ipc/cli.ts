import { Command } from "commander";
import { IpcIde } from "./IpcIde";
import { Core } from "./core";
import { IpcMessenger } from "./messenger";

const program = new Command();

program.action(() => {
  const messenger = new IpcMessenger();
  const ide = new IpcIde(messenger);
  const core = new Core(messenger, ide);
});

program.parse(process.argv);
