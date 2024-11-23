import { createNewFileTool } from "./definitions/createNewFile";
import { exactSearchTool } from "./definitions/exactSearch";
import { runTerminalCommandTool } from "./definitions/runTerminalCommand";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";
import { viewRepoMapTool } from "./definitions/viewRepoMap";
import { viewSubdirectoryTool } from "./definitions/viewSubdirectory";

export const allTools = [
  createNewFileTool,
  runTerminalCommandTool,
  viewSubdirectoryTool,
  viewRepoMapTool,
  exactSearchTool,
  searchWebTool,
  viewDiffTool,
];
