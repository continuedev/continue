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
  const allTools = getAllBuiltinTools();
  const tool = allTools.find((t) => t.function.name === toolName);
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
      name: tool.function.name,
      description: tool.function.description,
      parameters: {
        type: "object",
        required: tool.function.parameters.required,
        properties: tool.function.parameters.properties,
      },
    },
  };
}

export async function getAvailableTools() {
  // Load MCP tools
  const mcpState = await serviceContainer.get<MCPServiceState>(
    SERVICE_NAMES.MCP,
  );
  const tools = mcpState.tools ?? [];
  const mcpTools: Tool[] =
    tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters: {
          type: "object",
          properties: (t.inputSchema.properties ?? {}) as Record<
            string,
            ParameterSchema
          >,
          required: t.inputSchema.required,
        },
      },
      displayName: t.name.replace("mcp__", "").replace("ide__", ""),
      readonly: undefined, // MCP tools don't have readonly property
      isBuiltIn: false,
      run: async (args: any) => {
        const result = await mcpState.mcpService?.runTool(t.name, args);
        return JSON.stringify(result?.content) ?? "";
      },
    })) || [];

export function convertMcpToolToContinueTool(mcpTool: MCPTool): Tool {
  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description: mcpTool.description ?? "",
      parameters: {
        type: "object",
        properties: (mcpTool.inputSchema.properties ?? {}) as Record<
          string,
          ParameterSchema
        >,
        required: mcpTool.inputSchema.required,
      },
    },
    displayName: mcpTool.name.replace("mcp__", "").replace("ide__", ""),
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

    return `Error executing tool "${toolCall.name}": ${errorMessage}`;
  }
}

// Only checks top-level required
export function validateToolCallArgsPresent(toolCall: ToolCall, tool: Tool) {
  const requiredParams = tool.function.parameters.required ?? [];
  for (const [paramName] of Object.entries(
    tool.function.parameters.properties ?? {},
  )) {
    if (
      requiredParams.includes(paramName) &&
      (toolCall.arguments[paramName] === undefined ||
        toolCall.arguments[paramName] === null)
    ) {
      throw new Error(
        `Required parameter "${paramName}" missing for tool "${toolCall.name}"`,
      );
    }
  }
}
