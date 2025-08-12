import { ConfigDependentToolParams, IDE, Tool } from "..";
import * as toolDefinitions from "./definitions";

// I'm writing these as functions because we've messed up 3 TIMES by pushing to const, causing duplicate tool definitions on subsequent config loads.

// missing support for remote os calls: https://github.com/microsoft/vscode/issues/252269
const getLocalOnlyToolDefinitions = () => [toolDefinitions.grepSearchTool];

const getBaseToolDefinitions = () => [
  toolDefinitions.readFileTool,
  toolDefinitions.createNewFileTool,
  toolDefinitions.runTerminalCommandTool,
  toolDefinitions.globSearchTool,
  toolDefinitions.searchWebTool,
  toolDefinitions.viewDiffTool,
  toolDefinitions.readCurrentlyOpenFileTool,
  toolDefinitions.lsTool,
  toolDefinitions.createRuleBlock,
  toolDefinitions.fetchUrlContentTool,
];

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => [
  toolDefinitions.requestRuleTool(params),
  // Search and replace is now generally available
  toolDefinitions.searchAndReplaceInFileTool,
  // Keep edit file tool available for models that need it
  toolDefinitions.editFileTool,
  ...(params.enableExperimentalTools
    ? [
        toolDefinitions.viewRepoMapTool,
        toolDefinitions.viewSubdirectoryTool,
        toolDefinitions.codebaseTool,
      ]
    : []),
];

export const getToolsForIde = async (ide: IDE): Promise<Tool[]> =>
  (await ide.isWorkspaceRemote())
    ? getBaseToolDefinitions()
    : [...getBaseToolDefinitions(), ...getLocalOnlyToolDefinitions()];
