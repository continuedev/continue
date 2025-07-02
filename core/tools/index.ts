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
import { searchAndReplaceInFileTool } from "./definitions/searchAndReplaceInFile";
import { searchWebTool } from "./definitions/searchWeb";
import { viewDiffTool } from "./definitions/viewDiff";
import { viewRepoMapTool } from "./definitions/viewRepoMap";
import { viewSubdirectoryTool } from "./definitions/viewSubdirectory";

// missing support for remote os calls: https://github.com/microsoft/vscode/issues/252269
export const localOnlyToolDefinitions = [grepSearchTool];

export const baseToolDefinitions = [
  readFileTool,
  createNewFileTool,
  runTerminalCommandTool,
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

export const getToolsForIde = async (ide: IDE) =>
  (await ide.isWorkspaceRemote())
    ? baseToolDefinitions
    : [...baseToolDefinitions, ...localOnlyToolDefinitions];
