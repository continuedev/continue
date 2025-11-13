import { ConfigDependentToolParams, Tool } from "..";
import { isRecommendedAgentModel } from "../llm/toolSupport";
import * as toolDefinitions from "./definitions";

// I'm writing these as functions because we've messed up 3 TIMES by pushing to const, causing duplicate tool definitions on subsequent config loads.
export const getBaseToolDefinitions = () => [
  toolDefinitions.readFileTool,
  toolDefinitions.createNewFileTool,
  toolDefinitions.runTerminalCommandTool,
  toolDefinitions.globSearchTool,
  toolDefinitions.viewDiffTool,
  toolDefinitions.readCurrentlyOpenFileTool,
  toolDefinitions.lsTool,
  toolDefinitions.createRuleBlock,
  toolDefinitions.fetchUrlContentTool,
];

/**
 * Check if the model supports the Anthropic memory tool.
 * Memory tool is only available on Claude 4+ models.
 * Based on: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/memory
 */
const supportsMemoryTool = (modelName: string | undefined): boolean => {
  if (!modelName) {
    return false;
  }

  const normalized = modelName.toLowerCase();

  // Match any Claude 4+ family models (Sonnet, Opus, Haiku)
  // This handles both direct names and Bedrock ARN format
  // Examples:
  // - "claude-sonnet-4-20250514"
  // - "claude-sonnet-4-5-20250929"
  // - "anthropic.claude-sonnet-4-20250514-v1:0"
  // - "anthropic.claude-opus-4-1-20250805-v1:0"
  const claude4Patterns = [
    "claude-sonnet-4", // Matches any Claude 4 Sonnet (4.0, 4.5, etc.)
    "claude-opus-4", // Matches any Claude 4 Opus (4.0, 4.1, etc.)
    "claude-haiku-4", // Matches any Claude 4 Haiku (4.0, 4.5, etc.)
  ];

  return claude4Patterns.some((pattern) => normalized.includes(pattern));
};

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => {
  const { modelName, isSignedIn, enableExperimentalTools, isRemote } = params;
  const tools: Tool[] = [];

  tools.push(toolDefinitions.requestRuleTool(params));

  if (isSignedIn) {
    // Web search is only available for signed-in users
    tools.push(toolDefinitions.searchWebTool);
  }

  if (supportsMemoryTool(modelName) && enableExperimentalTools) {
    tools.push(toolDefinitions.memoryTool);
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
