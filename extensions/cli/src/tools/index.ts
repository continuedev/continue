import {
  getServiceSync,
  MCPServiceState,
  SERVICE_NAMES,
  serviceContainer,
} from "../services/index.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { logger } from "../util/logger.js";

import { editTool } from "./edit.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { formatToolArgument } from "./formatters.js";
import { listFilesTool } from "./listFiles.js";
import { multiEditTool } from "./multiEdit.js";
import { readFileTool } from "./readFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import {
  type Tool,
  type ToolCall,
  type ToolParameters,
  PreprocessedToolCall,
} from "./types.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

export type { Tool, ToolCall, ToolParameters };

// Base tools that are always available
const BASE_BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  editTool,
  multiEditTool,
  writeFileTool,
  // searchAndReplaceInFileTool,
  listFilesTool,
  searchCodeTool,
  runTerminalCommandTool,
  fetchTool,
  writeChecklistTool,
];

// Export BUILTIN_TOOLS as the base set of tools
// Dynamic tools (like exit tool in headless mode) are added separately
export const BUILTIN_TOOLS: Tool[] = BASE_BUILTIN_TOOLS;

// Get dynamic tools based on current state
function getDynamicTools(): Tool[] {
  const dynamicTools: Tool[] = [];

  // Add headless-specific tools if in headless mode
  try {
    const serviceResult = getServiceSync<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );
    const isHeadless = serviceResult.value?.isHeadless ?? false;
    if (isHeadless) {
      dynamicTools.push(exitTool);
    }
  } catch {
    // Service not ready yet, no dynamic tools
  }

  return dynamicTools;
}

// Get all builtin tools including dynamic ones
export function getAllBuiltinTools(): Tool[] {
  return [...BUILTIN_TOOLS, ...getDynamicTools()];
}

export function getToolDisplayName(toolName: string): string {
  const allTools = getAllBuiltinTools();
  const tool = allTools.find((t) => t.name === toolName);
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

function convertInputSchemaToParameters(inputSchema: any): ToolParameters {
  const parameters: Record<
    string,
    { type: string; description: string; required: boolean }
  > = {};
  for (const [key, value] of Object.entries(inputSchema.properties)) {
    const val = value as any;
    parameters[key] = {
      type: val.type,
      description: val.description || "",
      required: inputSchema.required?.includes(key) || false,
    };
  }
  return parameters;
}

export async function getAvailableTools() {
  // Load MCP tools
  const mcpState = await serviceContainer.get<MCPServiceState>(
    SERVICE_NAMES.MCP,
  );
  const tools = mcpState.tools ?? [];
  const mcpTools: Tool[] =
    tools.map((t) => ({
      name: t.name,
      displayName: t.name.replace("mcp__", "").replace("ide__", ""),
      description: t.description ?? "",
      parameters: convertInputSchemaToParameters(t.inputSchema),
      readonly: undefined, // MCP tools don't have readonly property
      isBuiltIn: false,
      run: async (args: any) => {
        const result = await mcpState.mcpService?.runTool(t.name, args);
        return JSON.stringify(result?.content) ?? "";
      },
    })) || [];

  const allTools: Tool[] = [...getAllBuiltinTools(), ...mcpTools];
  return allTools;
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

    logger.debug("Tool execution completed", {
      toolName: toolCall.name,
      resultLength: result?.length || 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    telemetryService.logToolResult({
      toolName: toolCall.name,
      success: false,
      durationMs: duration,
      error: errorMessage,
      toolParameters: JSON.stringify(toolCall.arguments),
    });

    return `Error executing tool "${toolCall.name}": ${errorMessage}`;
  }
}

export function validateToolCallArgsPresent(toolCall: ToolCall, tool: Tool) {
  for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
    if (
      paramDef.required &&
      (toolCall.arguments[paramName] === undefined ||
        toolCall.arguments[paramName] === null)
    ) {
      throw new Error(
        `Required parameter "${paramName}" missing for tool "${toolCall.name}"`,
      );
    }
  }
}

/**
 * Formats a tool call with its arguments for display
 * @param toolName The name of the tool
 * @param args The tool arguments
 * @returns A formatted string like "ToolName(arg)" or just "ToolName" if no args
 */
export function formatToolCall(toolName: string, args?: any): string {
  const displayName = getToolDisplayName(toolName);

  if (!args || Object.keys(args).length === 0) {
    return displayName;
  }

  // Get the first argument value if it's a simple one
  let formattedValue = "";
  const [key, value] = Object.entries(args)[0];
  if (
    key.toLowerCase().includes("path") ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    formattedValue = formatToolArgument(value);
  } else if (typeof value === "string") {
    const valueLines = value.split("\n");
    if (valueLines.length === 1) {
      formattedValue = formatToolArgument(value);
    }
  }

  return `${displayName}(${formattedValue})`;
}
