import { parseArgs } from "../args.js";
import { MCPService } from "../mcp.js";
import { exitTool } from "./exit.js";
import { listFilesTool } from "./listFiles.js";
import { readFileTool } from "./readFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { Tool, ToolParameters } from "./types.js";
import { viewDiffTool } from "./viewDiff.js";
import { writeFileTool } from "./writeFile.js";

export { Tool } from "./types.js";

export const BUILTIN_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  viewDiffTool,
  searchCodeTool,
  runTerminalCommandTool,
  // When in headless mode, there is a tool that the LLM can call to make the GitHub Action fail
  ...(parseArgs().isHeadless ? [exitTool] : []),
];

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
      console.error("Failed to parse tool call:", match[1]);
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
  const allTools: Tool[] = [
    ...BUILTIN_TOOLS,
    ...(MCPService.getInstance()
      ?.getTools()
      .map((t) => ({
        name: t.name,
        description: t.description ?? "",
        parameters: convertInputSchemaToParameters(t.inputSchema),
        run: async (args: any) => {
          const result = await MCPService.getInstance()?.runTool(t.name, args);
          return JSON.stringify(result?.content) ?? "";
        },
      })) || []),
  ];
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
    return await tool.run(toolCall.arguments);
  } catch (error) {
    return `Error executing tool "${toolCall.name}": ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}
