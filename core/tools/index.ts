import { createNewFileTool } from "./definitions/createNewFile";
import { editFileTool } from "./definitions/editFile";
import { exactSearchTool } from "./definitions/exactSearch";
import { lsTool } from "./definitions/lsTool";
import { readCurrentlyOpenFileTool } from "./definitions/readCurrentlyOpenFile";
import { readFileTool } from "./definitions/readFile";
import { runTerminalCommandTool } from "./definitions/runTerminalCommand";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";

export const allTools = [
  readFileTool,
  editFileTool,
  createNewFileTool,
  runTerminalCommandTool,

  exactSearchTool,
  searchWebTool,
  viewDiffTool,
  readCurrentlyOpenFileTool,

  lsTool,
  // replacing with ls tool for now
  // viewSubdirectoryTool,
  // viewRepoMapTool,
];
