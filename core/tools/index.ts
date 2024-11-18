import { IDE, Tool } from "..";
import { getPathModuleForIde } from "../util/pathModule";

export interface ToolParams {
  ide: IDE;
}

export const makeCreateNewFileTool = ({ ide }: ToolParams): Tool => ({
  type: "function",
  action: async (args: any) => {
    const pathSep = await ide.pathSep();
    let filepath = args.filepath;
    if (!args.filepath.startsWith(pathSep)) {
      const pathModule = await getPathModuleForIde(ide);
      const workspaceDirs = await ide.getWorkspaceDirs();
      const cwd = workspaceDirs[0];
      filepath = pathModule.join(cwd, filepath);
    }
    await ide.writeFile(filepath, args.contents);
    await ide.openFile(filepath);
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

export const runTerminalCommandTool = ({ ide }: ToolParams): Tool => ({
  type: "function",
  action: async (args) => {
    await ide.runCommand(args.command);
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

export function instantiateTool(name: string, { ide }: ToolParams): Tool {
  switch (name) {
    case "create_new_file":
      return makeCreateNewFileTool({ ide });
    case "run_terminal_command":
      return runTerminalCommandTool({ ide });
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
