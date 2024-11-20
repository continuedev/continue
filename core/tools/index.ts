import { createNewFileTool } from "./createNewFile";
import { exactSearchTool } from "./exactSearch";
import { runTerminalCommandTool } from "./runTerminalCommand";
import { searchWebTool } from "./searchWeb";
import { viewDiffTool } from "./viewDiff";
import { viewFileTreeTool } from "./viewFileTree";
import { viewSubdirectoryTool } from "./viewSubdirectory";

export const allTools = [
  createNewFileTool,
  runTerminalCommandTool,
  runTerminalCommandTool,
  viewSubdirectoryTool,
  viewFileTreeTool,
  exactSearchTool,
  searchWebTool,
  viewDiffTool,
];
