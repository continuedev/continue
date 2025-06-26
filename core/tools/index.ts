import { ConfigDependentToolParams, Tool } from "..";
import { createNewFileTool } from "./definitions/createNewFile";
import { createRuleBlock } from "./definitions/createRuleBlock";
import { editFileTool } from "./definitions/editFile";
import { fetchUrlContentTool } from "./definitions/fetchUrlContent";
import { globSearchTool } from "./definitions/globSearch";
import { grepSearchTool } from "./definitions/grepSearch";
import { lsTool } from "./definitions/lsTool";
import { readCurrentlyOpenFileTool } from "./definitions/readCurrentlyOpenFile";
import { readFileTool } from "./definitions/readFile";
import { requestRuleTool } from "./definitions/requestRule";
import { runTerminalCommandTool } from "./definitions/runTerminalCommand";
import { searchAndReplaceInFileTool } from "./definitions/searchAndReplaceInFile";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";
import { viewRepoMapTool } from "./definitions/viewRepoMap";
import { viewSubdirectoryTool } from "./definitions/viewSubdirectory";

export const baseToolDefinitions = [
  readFileTool,
  createNewFileTool,
  runTerminalCommandTool,
  grepSearchTool,
  globSearchTool,
  searchWebTool,
  viewDiffTool,
  readCurrentlyOpenFileTool,
  lsTool,
  createRuleBlock,
  fetchUrlContentTool,
];

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => [
  requestRuleTool(params),
  ...(params.enableExperimentalTools
    ? [searchAndReplaceInFileTool, viewRepoMapTool, viewSubdirectoryTool]
    : [editFileTool]),
];
