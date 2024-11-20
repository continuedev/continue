import { Tool } from "..";
import { makeCreateNewFileTool } from "./createNewFile";
import { runTerminalCommandTool } from "./runTerminalCommand";
import { ToolParams } from "./types";

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
