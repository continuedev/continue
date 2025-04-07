import { listFilesTool } from "./listFiles.js";
import { readFileTool } from "./readFile.js";
import { searchCodeTool } from "./searchCode.js";
import { Tool } from "./types.js";
import { viewDiffTool } from "./viewDiff.js";
import { writeFileTool } from "./writeFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";

export { Tool } from "./types.js";

export const tools: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  viewDiffTool,
  searchCodeTool,
  runTerminalCommandTool,
];

export function getToolsDescription(): string {
  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(
          ([name, param]) =>
            `    "${name}": { "type": "${param.type}", "description": "${param.description}", "required": ${param.required} }`,
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
    })
    .join(",\n");
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
    } catch (e) {
      console.error("Failed to parse tool call:", match[1]);
    }
  }

  return toolCalls;
}

export async function executeToolCall(toolCall: {
  name: string;
  arguments: Record<string, any>;
}): Promise<string> {
  const tool = tools.find((t) => t.name === toolCall.name);

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
    return `Error executing tool "${toolCall.name}": ${error instanceof Error ? error.message : String(error)}`;
  }
}
