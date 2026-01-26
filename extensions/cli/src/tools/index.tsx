// @ts-ignore
import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { ChatCompletionTool } from "openai/resources.mjs";

import { posthogService } from "src/telemetry/posthogService.js";
import { isModelCapable } from "src/utils/modelCapability.js";

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
import { telemetryService } from "../telemetry/telemetryService.js";
import { logger } from "../util/logger.js";

import { ALL_BUILT_IN_TOOLS } from "./allBuiltIns.js";
import { editTool } from "./edit.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { listFilesTool } from "./listFiles.js";
import { multiEditTool } from "./multiEdit.js";
import { readFileTool } from "./readFile.js";
import { reportFailureTool } from "./reportFailure.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { checkIfRipgrepIsInstalled, searchCodeTool } from "./searchCode.js";
import { skillsTool } from "./skills.js";
import { subagentTool } from "./subagent.js";
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
  writeChecklistTool,
];

const BUILTIN_SEARCH_TOOLS: Tool[] = [searchCodeTool];

// Get all builtin tools including dynamic ones, with capability-based filtering
export async function getAllAvailableTools(
  isHeadless: boolean,
): Promise<Tool[]> {
  const tools = [...BASE_BUILTIN_TOOLS];

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

  if (isHeadless) {
    tools.push(exitTool);
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
    readonly: undefined, // MCP tools don't have readonly property
    isBuiltIn: false,
    run: async (args: any) => {
      const result = await services.mcp?.runTool(mcpTool.name, args);
      return JSON.stringify(result?.content) ?? "";
    },
  };
}

export async function executeToolCall(
  toolCall: PreprocessedToolCall,
  options: { parallelToolCallCount: number } = { parallelToolCallCount: 1 },
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
    void posthogService.capture("tool_call_outcome", {
      succeeded: true,
      toolName: toolCall.name,
      duration_ms: duration,
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
    void posthogService.capture("tool_call_outcome", {
      succeeded: false,
      toolName: toolCall.name,
      duration_ms: duration,
      errorReason,
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
