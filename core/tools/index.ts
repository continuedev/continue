import { ConfigDependentToolParams, Tool } from "..";
import { isRecommendedAgentModel } from "../llm/toolSupport";
import * as toolDefinitions from "./definitions";

export const TOOL_PRESETS = ["default"] as const;
export type ToolPreset = (typeof TOOL_PRESETS)[number];

export function parseToolPreset(preset: string): ToolPreset | null {
  const normalized = preset.toLowerCase();
  if (!TOOL_PRESETS.includes(normalized as ToolPreset)) {
    return null;
  }
  return normalized as ToolPreset;
}

// I'm writing these as functions because we've messed up 3 TIMES by pushing to const, causing duplicate tool definitions on subsequent config loads.
export const getBaseToolDefinitions = () => [
  toolDefinitions.readFileTool,
  toolDefinitions.createNewFileTool,
  toolDefinitions.runTerminalCommandTool,
  toolDefinitions.globSearchTool,
  toolDefinitions.enterPlanModeTool,
  toolDefinitions.exitPlanModeTool,
  toolDefinitions.notebookEditTool,
  toolDefinitions.viewDiffTool,
  toolDefinitions.readCurrentlyOpenFileTool,
  toolDefinitions.lsTool,
  toolDefinitions.createRuleBlock,
  toolDefinitions.fetchUrlContentTool,
  toolDefinitions.sleepTool,
  toolDefinitions.subagentTool,
  toolDefinitions.todoWriteTool,
  toolDefinitions.taskCreateTool,
  toolDefinitions.taskGetTool,
  toolDefinitions.taskListTool,
  toolDefinitions.taskOutputTool,
  toolDefinitions.taskStopTool,
  toolDefinitions.taskUpdateTool,
  toolDefinitions.teamCreateTool,
  toolDefinitions.teamDeleteTool,
  toolDefinitions.teamStatusTool,
  toolDefinitions.teamMailboxTool,
  toolDefinitions.sendMessageTool,
  toolDefinitions.configTool,
  toolDefinitions.statusTool,
  toolDefinitions.askUserQuestionTool,
  toolDefinitions.lspQueryTool,
  toolDefinitions.notifyUserTool,
  toolDefinitions.enterWorktreeTool,
  toolDefinitions.exitWorktreeTool,
  toolDefinitions.toolSearchTool,
  toolDefinitions.gitTool,
  toolDefinitions.githubTool,
  toolDefinitions.listMcpResourcesTool,
  toolDefinitions.readMcpResourceTool,
  toolDefinitions.mcpAuthTool,
];

export const getConfigDependentToolDefinitions = async (
  params: ConfigDependentToolParams,
): Promise<Tool[]> => {
  const { modelName, isSignedIn, enableExperimentalTools, isRemote } = params;
  const tools: Tool[] = [];

  tools.push(await toolDefinitions.requestRuleTool(params));
  tools.push(await toolDefinitions.readSkillTool(params));
  tools.push(await toolDefinitions.skillTool(params));

  if (isSignedIn) {
    // Web search is only available for signed-in users
    tools.push(toolDefinitions.searchWebTool);
  }

  if (enableExperimentalTools) {
    tools.push(
      toolDefinitions.viewRepoMapTool,
      toolDefinitions.viewSubdirectoryTool,
      toolDefinitions.codebaseTool,
      toolDefinitions.readFileRangeTool,
    );
  }

  if (modelName && isRecommendedAgentModel(modelName)) {
    tools.push(toolDefinitions.multiEditTool);
  } else {
    tools.push(toolDefinitions.editFileTool);
    tools.push(toolDefinitions.singleFindAndReplaceTool);
  }

  // missing support for remote os calls: https://github.com/microsoft/vscode/issues/252269
  if (!isRemote) {
    tools.push(toolDefinitions.grepSearchTool);
  }

  return tools;
};

export async function getToolDefinitionsForPreset(
  preset: ToolPreset,
  params: ConfigDependentToolParams,
): Promise<Tool[]> {
  switch (preset) {
    case "default":
    default:
      return [
        ...getBaseToolDefinitions(),
        ...(await getConfigDependentToolDefinitions(params)),
      ];
  }
}

export function serializeTool(tool: Tool) {
  const { preprocessArgs, evaluateToolCallPolicy, ...rest } = tool;
  return rest;
}
