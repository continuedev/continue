import { createNewFileTool } from "./definitions/createNewFile";
import { globSearchTool } from "./definitions/globSearch";
import { grepSearchTool } from "./definitions/grepSearch";
import { lsTool } from "./definitions/lsTool";
import { readCurrentlyOpenFileTool } from "./definitions/readCurrentlyOpenFile";
import { readFileTool } from "./definitions/readFile";
import { runTerminalCommandTool } from "./definitions/runTerminalCommand";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";

export const allTools = [
  readFileTool,
  createNewFileTool,
  runTerminalCommandTool,

  grepSearchTool,
  globSearchTool,
  searchWebTool,
  viewDiffTool,
  readCurrentlyOpenFileTool,

  lsTool,
  // replacing with ls tool for now
  // viewSubdirectoryTool,
  // viewRepoMapTool,
];
