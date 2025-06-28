import { ConfigDependentToolParams, IDE, Tool } from "..";
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

// missing support for remote os calls: https://github.com/microsoft/vscode/issues/252269
export const localOnlyToolDefinitions = [grepSearchTool];

export const baseToolDefinitions = [
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

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => [requestRuleTool(params)];

export const getToolsForIde = async (ide: IDE) =>
  (await ide.isWorkspaceRemote())
    ? baseToolDefinitions
    : [...baseToolDefinitions, ...localOnlyToolDefinitions];
