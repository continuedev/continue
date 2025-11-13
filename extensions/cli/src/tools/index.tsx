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
import { memoryTool } from "./memory.js";
import { multiEditTool } from "./multiEdit.js";
import { readFileTool } from "./readFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { statusTool } from "./status.js";
import {
  type Tool,
  type ToolCall,
  type ToolParametersSchema,
  ParameterSchema,
  PreprocessedToolCall,
} from "./types.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

export type { Tool, ToolCall, ToolParametersSchema };

// Base tools that are always available
const BASE_BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchCodeTool,
  runTerminalCommandTool,
  fetchTool,
  writeChecklistTool,
];

// Get all builtin tools including dynamic ones, with capability-based filtering
export async function getAllAvailableTools(
  isHeadless: boolean,
): Promise<Tool[]> {
  const tools = [...BASE_BUILTIN_TOOLS];

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
  return false;
}

/**
 * Check if the model supports the Anthropic memory tool.
 * Memory tool is only available on Claude 4+ models.
 * Based on: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/memory
 */
function supportsMemoryTool(modelName?: string | null): boolean {
  if (!modelName || typeof modelName !== "string") {
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
}

function shouldIncludeMemoryTool(): boolean {
  try {
    const modelServiceResult = getServiceSync<ModelServiceState>(
      SERVICE_NAMES.MODEL,
    );

    if (
      modelServiceResult.state === "ready" &&
      modelServiceResult.value?.model
    ) {
      const { name, provider, model } = modelServiceResult.value.model;

      // Check both the name and model fields
      const isSupported = supportsMemoryTool(name) || supportsMemoryTool(model);

      if (isSupported) {
        logger.debug("Enabling memory tool for supported Claude model", {
          provider,
          name,
          model,
        });
      }

      return isSupported;
    }
  } catch (error) {
    logger.debug("Error checking model for memory tool support", {
      error,
    });
  }

  return false;
}

// Get all builtin tools including dynamic ones, with capability-based filtering
export function getAllBuiltinTools(): Tool[] {
  let builtinTools = [...BUILTIN_TOOLS];

  if (shouldIncludeMemoryTool()) {
    const insertAt =
      MEMORY_TOOL_INSERT_INDEX === -1
        ? builtinTools.length
        : MEMORY_TOOL_INSERT_INDEX;
    builtinTools.splice(insertAt, 0, memoryTool);
  }

  // Apply capability-based filtering for edit tools
  // If model is capable, exclude editTool in favor of multiEditTool
  if (shouldExcludeEditTool()) {
    builtinTools = builtinTools.filter((tool) => tool.name !== editTool.name);
    logger.debug(
      "Excluded Edit tool for capable model - MultiEdit will be used instead",
    );

  // Add beta status tool if --beta-status-tool flag is present
  if (process.argv.includes("--beta-status-tool")) {
    tools.push(statusTool);
  }

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
    displayName: mcpTool.name.replace("mcp__", "").replace("ide__", ""),
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
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.debug("Executing tool", {
      toolName: toolCall.name,
      arguments: toolCall.arguments,
    });

    // IMPORTANT: if preprocessed args are present, uses preprocessed args instead of original args
    // Preprocessed arg names may be different
    const result = await toolCall.tool.run(
      toolCall.preprocessResult?.args ?? toolCall.arguments,
    );
    const duration = Date.now() - startTime;

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
