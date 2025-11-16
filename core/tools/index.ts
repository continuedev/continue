import { ConfigDependentToolParams, Tool } from "..";
import { isRecommendedAgentModel } from "../llm/toolSupport";
import * as toolDefinitions from "./definitions";
import { logExecuteCodeDebug } from "./executeCodeDebug";

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

export const getConfigDependentToolDefinitions = (
  params: ConfigDependentToolParams,
): Tool[] => {
  const { modelName, isSignedIn, enableExperimentalTools, isRemote } = params;
  const tools: Tool[] = [];
  console.debug("PARAMS:", params);
  tools.push(toolDefinitions.requestRuleTool(params));

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
      // execute code handled via codeExecutionConfig gate
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

  const codeExecutionConfig = params.codeExecutionConfig;
  console.log("CodeExecutionConfig: ", codeExecutionConfig);
  //This is always coming up as undefined.
  if (!codeExecutionConfig) {
    console.log(
      "Skipping execute_code tool: no experimental.codeExecution block found",
    );
    logExecuteCodeDebug(
      "Skipping execute_code tool: no experimental.codeExecution block found",
      {
        enableExperimentalTools,
        isSignedIn,
      },
    );
  } else if (codeExecutionConfig.enabled) {
    logExecuteCodeDebug("Registering execute_code tool", {
      hasApiKey: Boolean(codeExecutionConfig.e2bApiKey),
      requireFirstUseConfirmation:
        codeExecutionConfig.requireFirstUseConfirmation ?? true,
    });
    tools.push(toolDefinitions.executeCodeTool(params));
  } else {
    logExecuteCodeDebug("Skipping execute_code tool: config disabled", {
      enabled: codeExecutionConfig.enabled ?? false,
    });
  }

  return tools;
};

export function serializeTool(tool: Tool) {
  const { preprocessArgs, evaluateToolCallPolicy, ...rest } = tool;
  return rest;
}
