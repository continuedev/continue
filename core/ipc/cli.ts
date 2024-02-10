import { Command } from "commander";
import { Core } from "./core";
import { IpcMessenger } from "./messenger";

const program = new Command();

program.action(() => {
  const messenger = new IpcMessenger();
  const core = new Core(messenger);
});

program.parse(process.argv);
