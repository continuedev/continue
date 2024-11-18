import { IDE, Tool } from "..";

export const makeCreateNewFileTool = (ide: IDE): Tool => ({
  type: "function",
  action: async (...args: any) => {
    await ide.writeFile(args[0], args[1]);
  },
  function: {
    name: "create_new_file",
    description: "Create a new file",
    parameters: {
      type: "object",
      required: ["filepath", "contents"],
      properties: {
        filepath: {
          type: "string",
          description: "The path where the new file should be created",
        },
        contents: {
          type: "string",
          description: "The contents to write to the new file",
        },
      },
    },
  },
});

export const runTerminalCommandTool = (ide: IDE): Tool => ({
  type: "function",
  action: async (...args) => {
    await ide.runCommand(args[0]);
  },
  function: {
    name: "run_terminal_command",
    description: "Run a terminal command in the current directory",
    parameters: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          description:
            "The command to run. This will be passed directly into the shell.",
        },
      },
    },
  },
});
