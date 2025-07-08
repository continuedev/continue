import { ConfigDependentToolParams, IDE, Tool } from "..";

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
  ...(params.enableExperimentalTools
    ? [
        toolDefinitions.searchAndReplaceInFileTool,
        toolDefinitions.viewRepoMapTool,
        toolDefinitions.viewSubdirectoryTool,
        toolDefinitions.codebaseTool,
      ]
    : [toolDefinitions.editFileTool]),
];

export const getToolsForIde = async (ide: IDE): Promise<Tool[]> =>
  (await ide.isWorkspaceRemote())
    ? getBaseToolDefinitions()
    : [...getBaseToolDefinitions(), ...getLocalOnlyToolDefinitions()];
