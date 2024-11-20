import { createNewFileTool } from "./createNewFile";
import { exactSearchTool } from "./exactSearch";
import { runTerminalCommandTool } from "./runTerminalCommand";
import { searchWebTool } from "./searchWeb";
import { viewDiffTool } from "./viewDiff";
import { viewRepoMapTool } from "./viewRepoMap";
import { viewSubdirectoryTool } from "./viewSubdirectory";

export const allTools = [
  createNewFileTool,
  runTerminalCommandTool,
  viewSubdirectoryTool,
  viewRepoMapTool,
  exactSearchTool,
  searchWebTool,
  viewDiffTool,
];
