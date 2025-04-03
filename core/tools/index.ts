import { Tool } from "..";
import { createNewFileTool } from "./definitions/createNewFile";
import { globTool } from "./definitions/globTool";
import { grepTool } from "./definitions/grepTool";
import { lsTool } from "./definitions/lsTool";
import { readCurrentlyOpenFileTool } from "./definitions/readCurrentlyOpenFile";
import { readFileTool } from "./definitions/readFile";
import { runTerminalCommandTool } from "./definitions/runTerminalCommand";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";

export const allTools: Tool[] = [
  readFileTool,
  createNewFileTool,
  runTerminalCommandTool,

  searchWebTool,
  viewDiffTool,
  readCurrentlyOpenFileTool,

  lsTool,
  globTool,
  grepTool,
  // replacing with ls tool for now
  // viewSubdirectoryTool,
  // viewRepoMapTool,
];
