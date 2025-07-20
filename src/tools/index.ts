import { parseArgs } from "../args.js";
import { MCPService } from "../mcp.js";
import logger from "../util/logger.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { listFilesTool } from "./listFiles.js";
import { readFileTool } from "./readFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { type Tool, type ToolParameters } from "./types.js";
import { writeFileTool } from "./writeFile.js";

export type { Tool, ToolParameters };

const ALL_BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
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

export function getToolsDescription(): string {
  return BUILTIN_TOOLS.map((tool) => {
    const params = Object.entries(tool.parameters)
      .map(
        ([name, param]) =>
          `    "${name}": { "type": "${param.type}", "description": "${param.description}", "required": ${param.required} }`
      )
      .join(",\n");

    return `{
  "name": "${tool.name}",
  "description": "${tool.description}",
  "parameters": {
    "type": "object",
    "properties": {
${params}
    },
    "required": [${Object.entries(tool.parameters)
      .filter(([_, param]) => param.required)
      .map(([name]) => `"${name}"`)
      .join(", ")}]
}
}`;
  }).join(",\n");
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

export async function executeToolCall(toolCall: {
  name: string;
  arguments: Record<string, any>;
}): Promise<string> {
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

  const tool = allTools.find((t) => t.name === toolCall.name);

  if (!tool) {
    return `Error: Tool "${toolCall.name}" not found`;
  }

  for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
    if (
      paramDef.required &&
      (toolCall.arguments[paramName] === undefined ||
        toolCall.arguments[paramName] === null)
    ) {
      return `Error: Required parameter "${paramName}" missing for tool "${toolCall.name}"`;
    }
  }

  try {
    logger.debug("Executing tool", {
      toolName: toolCall.name,
      arguments: toolCall.arguments,
    });
    const result = await tool.run(toolCall.arguments);
    logger.debug("Tool execution completed", {
      toolName: toolCall.name,
      resultLength: result?.length || 0,
    });
    return result;
  } catch (error) {
    return `Error executing tool "${toolCall.name}": ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}
