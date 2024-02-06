import { Command } from "commander";

const program = new Command();

program.argument("<name>", "input name").action((name) => {
  console.log(`Hello, ${name}`);
});

program.parse(process.argv);
