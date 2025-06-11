import { ConfigDependentToolParams, Tool } from "..";
import { createNewFileTool } from "./definitions/createNewFile";
import { createRuleBlock } from "./definitions/createRuleBlock";
import { editFileTool } from "./definitions/editFile";
import { globSearchTool } from "./definitions/globSearch";
import { grepSearchTool } from "./definitions/grepSearch";
import { lsTool } from "./definitions/lsTool";
import { readCurrentlyOpenFileTool } from "./definitions/readCurrentlyOpenFile";
import { readFileTool } from "./definitions/readFile";
import { readUrlTool } from "./definitions/readURL";
import { requestRuleTool } from "./definitions/requestRule";
import { runTerminalCommandTool } from "./definitions/runTerminalCommand";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";

export const baseToolDefinitions = [
  readFileTool,
  editFileTool,
  createNewFileTool,
  runTerminalCommandTool,
  grepSearchTool,
  globSearchTool,
  searchWebTool,
  viewDiffTool,
  readCurrentlyOpenFileTool,
  lsTool,
  createRuleBlock,
  readUrlTool,
  // replacing with ls tool for now
  // viewSubdirectoryTool,
  // viewRepoMapTool,
];

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => [requestRuleTool(params)];
