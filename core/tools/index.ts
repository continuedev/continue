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
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";

export const remoteToolDefinitions = [
  readFileTool,
  editFileTool,
  createNewFileTool,
  runTerminalCommandTool,
  globSearchTool,
  searchWebTool,
  viewDiffTool,
  readCurrentlyOpenFileTool,
  lsTool,
  createRuleBlock,
  fetchUrlContentTool,
  // replacing with ls tool for now
  // viewSubdirectoryTool,
  // viewRepoMapTool,
];

export const baseToolDefinitions = [...remoteToolDefinitions, grepSearchTool];

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => [requestRuleTool(params)];
