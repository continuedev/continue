import { parseArgs } from "../args.js";
import { MCPService } from "../mcp.js";
import telemetryService from "../telemetry/telemetryService.js";
import logger from "../util/logger.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { formatToolArgument } from "./formatters.js";
import { listFilesTool } from "./listFiles.js";
import { readFileTool } from "./readFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchAndReplaceInFileTool } from "./searchAndReplace/index.js";
import { searchCodeTool } from "./searchCode.js";
import {
  type Tool,
  type ToolParameters,
  type ToolCall,
  PreprocessedToolCall,
} from "./types.js";
import { writeFileTool } from "./writeFile.js";

export type { Tool, ToolParameters, ToolCall };

const ALL_BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  searchAndReplaceInFileTool,
  listFilesTool,
  searchCodeTool,
  runTerminalCommandTool,
  fetchTool,
  // When in headless mode, there is a tool that the LLM can call to make the GitHub Action fail
  ...(parseArgs().isHeadless ? [exitTool] : []),
];

export const BUILTIN_TOOLS: Tool[] = (() => {
  const args = parseArgs();

  if (args.noTools) {
    return [];
  }

  if (args.readonly) {
    return ALL_BUILTIN_TOOLS.filter((tool) => tool.readonly === true);
  }

  return ALL_BUILTIN_TOOLS;
})();

export function getToolDisplayName(toolName: string): string {
  const tool = BUILTIN_TOOLS.find((t) => t.name === toolName);
  return tool?.displayName || toolName;
}

export function extractToolCalls(
  response: string
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
    } catch (e) {
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
  const args = parseArgs();

  let mcpTools: Tool[] = [];

  // Don't load MCP tools if no-tools mode is enabled
  if (!args.noTools) {
    mcpTools =
      MCPService.getInstance()
        ?.getTools()
        .map((t) => ({
          name: t.name,
          displayName: t.name.replace("mcp__", "").replace("ide__", ""),
          description: t.description ?? "",
          parameters: convertInputSchemaToParameters(t.inputSchema),
          readonly: undefined, // MCP tools don't have readonly property, so we include them in readonly mode
          isBuiltIn: false,
          run: async (args: any) => {
            const result = await MCPService.getInstance()?.runTool(
              t.name,
              args
            );
            return JSON.stringify(result?.content) ?? "";
          },
        })) || [];

    // Filter MCP tools in readonly mode - include them since they don't have readonly property
    if (args.readonly) {
      // MCP tools are included in readonly mode since they don't have an explicit readonly property
      // This is a design decision - you may want to exclude them entirely or handle them differently
    }
  }

  const allTools: Tool[] = [...BUILTIN_TOOLS, ...mcpTools];
  return allTools;
}

export async function executeToolCall(
  toolCall: PreprocessedToolCall
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
      toolCall.preprocessResult?.args ?? toolCall.arguments
    );
    const duration = Date.now() - startTime;

    telemetryService.logToolResult(
      toolCall.name,
      true,
      duration,
      undefined, // no error
      undefined, // no decision
      undefined, // no source
      JSON.stringify(toolCall.arguments)
    );

    logger.debug("Tool execution completed", {
      toolName: toolCall.name,
      resultLength: result?.length || 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    telemetryService.logToolResult(
      toolCall.name,
      false,
      duration,
      errorMessage,
      undefined, // no decision
      undefined, // no source
      JSON.stringify(toolCall.arguments)
    );

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
        `Required parameter "${paramName}" missing for tool "${toolCall.name}"`
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

  // Get the first argument value
  const firstValue = Object.values(args)[0];
  const formattedValue = formatToolArgument(firstValue);

  return `${displayName}(${formattedValue})`;
}
