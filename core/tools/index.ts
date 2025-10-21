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
 */
const supportsMemoryTool = (modelName: string | undefined): boolean => {
  if (!modelName) {
    return false;
  }

  const normalized = modelName.toLowerCase();
  
  // List of models that support the memory tool
  // Based on: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/memory
  const supportedModels = [
    "claude-sonnet-4-5-20250929",      // Claude Sonnet 4.5
    "claude-sonnet-4-20250514",        // Claude Sonnet 4
    "claude-haiku-4-5-20251001",       // Claude Haiku 4.5
    "claude-opus-4-1-20250805",        // Claude Opus 4.1
    "claude-opus-4-20250514",          // Claude Opus 4
  ];

  // Check if the model name matches any of the supported models
  // This handles both direct model names and Bedrock ARN format
  // (e.g., "anthropic.claude-sonnet-4-20250514-v1:0")
  return supportedModels.some(model => normalized.includes(model));
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
