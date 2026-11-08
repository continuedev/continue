// @ts-ignore
import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { ChatCompletionTool } from "openai/resources.mjs";

import { isModelCapable } from "src/utils/modelCapability.js";

import { loopItemRunning, loopRunGoing } from "../loop/loopSession.js";
import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../services/index.js";
import type {
  MCPServiceState,
  MCPTool,
  ModelServiceState,
} from "../services/types.js";
import { getSessionTaskPlan } from "../session.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { logger } from "../util/logger.js";

import { ALL_BUILT_IN_TOOLS } from "./allBuiltIns.js";
import { askQuestionTool } from "./askQuestion.js";
import { checkBackgroundJobTool } from "./checkBackgroundJob.js";
import { editTool } from "./edit.js";
import { fetchTool } from "./fetch.js";
import { listFilesTool } from "./listFiles.js";
import { finishItemTool, holdQuestionTool, remindMeTool } from "./loopTools.js";
import { multiEditTool } from "./multiEdit.js";
import { presentPlanTool } from "./presentPlan.js";
import { readFileTool } from "./readFile.js";
import { reportFailureTool } from "./reportFailure.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { checkIfRipgrepIsInstalled, searchCodeTool } from "./searchCode.js";
import { skillsTool } from "./skills.js";
import { subagentTool } from "./subagent.js";
import { taskListTool } from "./taskList.js";
import {
  isBetaSubagentToolEnabled,
  isBetaUploadArtifactToolEnabled,
} from "./toolsConfig.js";
import {
  type Tool,
  type ToolCall,
  type ToolParametersSchema,
  type ToolRunContext,
  ParameterSchema,
  PreprocessedToolCall,
} from "./types.js";
import { uploadArtifactTool } from "./uploadArtifact.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

export type { Tool, ToolCall, ToolParametersSchema };

/**
 * Extract the agent ID from the --id command line flag
 */
function getAgentIdFromArgs(): string | undefined {
  const args = process.argv;
  const idIndex = args.indexOf("--id");
  if (idIndex !== -1 && idIndex + 1 < args.length) {
    return args[idIndex + 1];
  }
  return undefined;
}

// Base tools that are always available
const BASE_BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  runTerminalCommandTool,
  fetchTool,
  taskListTool,
  checkBackgroundJobTool,
  askQuestionTool,
];

const BUILTIN_SEARCH_TOOLS: Tool[] = [searchCodeTool];

// Get all builtin tools including dynamic ones, with capability-based filtering
export async function getAllAvailableTools(
  isHeadless: boolean,
): Promise<Tool[]> {
  // Loop mode: while it runs an item, the item reports with FinishItem and
  // asks with HoldQuestion, and the loop owns the task list.
  const loopItem =
    loopItemRunning() && services.toolPermissions.getCurrentMode() !== "plan";
  const tools = loopItem
    ? [
        ...BASE_BUILTIN_TOOLS.filter((t) => t !== taskListTool),
        holdQuestionTool,
        remindMeTool,
        finishItemTool,
      ]
    : [...BASE_BUILTIN_TOOLS];
  // Plan mode does not offer the task list: PresentPlan's to-dos become the
  // list, and a model offered both resent the list instead of planning
  // (research-bedrock-families.md item 3). Outside plan mode the model acts
  // and gets the tool only to keep a list a plan left.
  const mode = services.toolPermissions.getCurrentMode();
  if (mode === "plan" || (!loopItem && !getSessionTaskPlan()?.items.length)) {
    const at = tools.indexOf(taskListTool);
    if (at !== -1) tools.splice(at, 1);
  }

  // A loop's questions go through HoldQuestion. Headless runs and `cn serve`
  // keep AskQuestion in plan mode only: there it does not wait (the question
  // is held in the inbox, src/util/pendingQuestions.ts) and a model that
  // asked in text would otherwise end its turn with no plan. While acting,
  // a headless model decides for itself and reports what it assumed.
  const headlessRun = isHeadless || services.toolPermissions.isHeadless();
  if (
    loopRunGoing() ||
    (headlessRun && services.toolPermissions.getCurrentMode() !== "plan")
  ) {
    tools.splice(tools.indexOf(askQuestionTool), 1);
  }

  const isRipgrepInstalled = await checkIfRipgrepIsInstalled();
  if (isRipgrepInstalled) {
    tools.push(...BUILTIN_SEARCH_TOOLS);
  }

  // Add agent-specific tools if agent ID is present
  // (these require --id to function and will confuse the agent if unavailable)
  const agentId = getAgentIdFromArgs();
  if (agentId) {
    tools.push(reportFailureTool);

    // UploadArtifact tool is gated behind beta flag
    if (isBetaUploadArtifactToolEnabled()) {
      tools.push(uploadArtifactTool);
    }
  }

  // If model is capable, exclude editTool in favor of multiEditTool
  const modelState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL,
  );
  if (!modelState.model) {
    throw new Error("Model service is not initialized");
  }

  const { provider, name, model } = modelState.model;

  const isCapable = isModelCapable(provider, name, model);
  if (isCapable) {
    tools.push(multiEditTool);
  } else {
    tools.push(editTool);
    logger.debug(
      "Excluded Edit tool for capable model - MultiEdit will be used instead",
    );
  }

  logger.debug("Capability-based tool filtering", {
    provider,
    name,
    isCapable,
  });

  // Exit is not offered to the model. In headless runs and `cn serve` a model
  // that could not ask a question called it and killed the process; the
  // tool stays registered (allBuiltIns) for permission policies that name it.

  // Presenting a plan is how plan mode ends, so only plan mode offers it.
  if (services.toolPermissions.getCurrentMode() === "plan") {
    tools.push(presentPlanTool);
  }

  if (isBetaSubagentToolEnabled()) {
    tools.push(await subagentTool());
  }

  tools.push(await skillsTool());

  const mcpState = await serviceContainer.get<MCPServiceState>(
    SERVICE_NAMES.MCP,
  );
  tools.push(...mcpState.tools.map(convertMcpToolToContinueTool));

  return tools;
}

/**
 * Tools that are not offered to the model but still run when it calls them by
 * name: `Checklist` maps its markdown list onto `TaskList`, for prompts, rules
 * and resumed sessions that still name it.
 */
export const TOOL_ALIASES: Tool[] = [writeChecklistTool];

export function getToolDisplayName(toolName: string): string {
  const tool = ALL_BUILT_IN_TOOLS.find((t) => t.name === toolName);
  return tool?.displayName || toolName;
}

export function extractToolCalls(
  response: string,
): Array<{ name: string; arguments: Record<string, any> }> {
  const toolCallRegex = /<tool>([\s\S]*?)<\/tool>/g;
  const matches = [...response.matchAll(toolCallRegex)];

  const toolCalls = [];

  for (const match of matches) {
    try {
      const toolCallJson = JSON.parse(match[1]);
      if (toolCallJson.name && toolCallJson.arguments) {
        toolCalls.push({
          name: toolCallJson.name,
          arguments: toolCallJson.arguments,
        });
      }
    } catch {
      logger.error("Failed to parse tool call:", { toolCall: match[1] });
    }
  }

  return toolCalls;
}

export function convertToolToChatCompletionTool(
  tool: Tool,
): ChatCompletionTool {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        required: tool.parameters.required,
        properties: tool.parameters.properties,
      },
    },
  };
}

export function convertMcpToolToContinueTool(mcpTool: MCPTool): Tool {
  return {
    name: mcpTool.name,
    displayName: mcpTool.name,
    description: mcpTool.description ?? "",
    parameters: {
      type: "object",
      properties: (mcpTool.inputSchema.properties ?? {}) as Record<
        string,
        ParameterSchema
      >,
      required: mcpTool.inputSchema.required,
    },
    // A server's own word that the tool changes nothing
    readonly: mcpTool.annotations?.readOnlyHint === true ? true : undefined,
    isBuiltIn: false,
    run: async (args: any) => {
      const result = await services.mcp?.runTool(mcpTool.name, args);
      return JSON.stringify(result?.content) ?? "";
    },
  };
}

export async function executeToolCall(
  toolCall: PreprocessedToolCall,
  options: Omit<ToolRunContext, "toolCallId"> = { parallelToolCallCount: 1 },
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.debug("Executing tool", {
      toolName: toolCall.name,
      arguments: toolCall.arguments,
      parallelToolCallCount: options.parallelToolCallCount,
    });

    // Track edits if Git AI is enabled (no-op if not enabled)
    await services.gitAiIntegration.trackToolUse(toolCall, "PreToolUse");

    const context: ToolRunContext = {
      toolCallId: toolCall.id,
      parallelToolCallCount: options.parallelToolCallCount,
      abortSignal: options.abortSignal,
      onToolPermissionRequest: options.onToolPermissionRequest,
    };

    // IMPORTANT: if preprocessed args are present, uses preprocessed args instead of original args
    // Preprocessed arg names may be different
    const result = await toolCall.tool.run(
      toolCall.preprocessResult?.args ?? toolCall.arguments,
      context,
    );
    const duration = Date.now() - startTime;

    // Track edits if Git AI is enabled (no-op if not enabled)
    await services.gitAiIntegration.trackToolUse(toolCall, "PostToolUse");

    telemetryService.logToolResult({
      toolName: toolCall.name,
      success: true,
      durationMs: duration,
      toolParameters: JSON.stringify(toolCall.arguments),
    });
    logger.debug("Tool execution completed", {
      toolName: toolCall.name,
      resultLength: result?.length || 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorReason =
      error instanceof ContinueError
        ? error.reason
        : ContinueErrorReason.Unknown;

    telemetryService.logToolResult({
      toolName: toolCall.name,
      success: false,
      durationMs: duration,
      error: errorMessage,
      errorReason,
      toolParameters: JSON.stringify(toolCall.arguments),
    });
    throw error;
  }
}

// Only checks top-level required
export function validateToolCallArgsPresent(toolCall: ToolCall, tool: Tool) {
  const requiredParams = tool.parameters.required ?? [];
  for (const paramName of requiredParams) {
    if (
      toolCall.arguments[paramName] === undefined ||
      toolCall.arguments[paramName] === null
    ) {
      throw new Error(
        `Required parameter "${paramName}" missing for tool "${toolCall.name}"`,
      );
    }
  }
}
