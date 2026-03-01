import { Tool, ToolCallState } from "../../..";
import { SystemMessageToolsFramework } from "../types";
import { handleToolCallBuffer } from "./parseSystemToolCall";

export class SystemMessageToolCodeblocksFramework
  implements SystemMessageToolsFramework
{
  // Poor models are really bad at following instructions, alternate starts allowed:
  acceptedToolCallStarts: [string, string][] = [
    ["```tool\n", "```tool\n"],
    ["tool_name:", "```tool\nTOOL_NAME:"],
  ];

  toolCallStateToSystemToolCall(state: ToolCallState): string {
    let parts = ["```tool"];
    parts.push(`TOOL_NAME: ${state.toolCall.function.name}`);
    try {
      for (const arg in state.parsedArgs) {
        parts.push(`BEGIN_ARG: ${arg}`);
        parts.push(JSON.stringify(state.parsedArgs[arg]));
        parts.push(`END_ARG`);
      }
    } catch (e) {
      console.log("Failed to stringify json args", state.parsedArgs);
    }
    // TODO - include tool call id for parallel. Confuses dumb models
    parts.push("```");
    return parts.join("\n");
  }

  handleToolCallBuffer = handleToolCallBuffer;

  toolToSystemToolDefinition(tool: Tool): string {
    let toolDefinition = `\`\`\`tool_definition\nTOOL_NAME: ${tool.function.name}\n`;

    if (tool.function.description) {
      toolDefinition += `TOOL_DESCRIPTION:\n${tool.function.description}\n`;
    }

    if (tool.function.parameters && "properties" in tool.function.parameters) {
      for (const [key, value] of Object.entries(
        tool.function.parameters.properties as object,
      )) {
        const isRequired = tool.function.parameters.required?.includes(key);
        const requiredText = isRequired ? "required" : "optional";

        let argType = "string";
        if ("type" in value) {
          argType = value.type;
        }
        let argDescription = "";
        if ("description" in value) {
          argDescription = value.description;
        }

        toolDefinition += `TOOL_ARG: ${key} (${argType}, ${requiredText})\n`;
        if (argDescription) {
          toolDefinition += argDescription + "\n";
        }
        toolDefinition += `END_ARG\n`;
      }
    }

    toolDefinition += `\`\`\``;
    return toolDefinition.trim();
  }

  systemMessagePrefix = `You have access to tools. To call a tool, you MUST respond with EXACTLY this format — a tool code block (\`\`\`tool) using the syntax shown below.

CRITICAL: Follow the exact syntax. Do not use XML tags, JSON objects, or any other format for tool calls.`;

  systemMessageSuffix = `RULES FOR TOOL USE:
1. To call a tool, output a \`\`\`tool code block using EXACTLY the format shown above.
2. Always start the code block on a new line.
3. You can only call ONE tool at a time.
4. The \`\`\`tool code block MUST be the last thing in your response. Stop immediately after the closing \`\`\`.
5. Do NOT wrap tool calls in XML tags like <tool_call> or <function=...>.
6. Do NOT use JSON format for tool calls.
7. Do NOT invent tools that are not listed above.
8. If the user's request can be addressed with a listed tool, use it rather than guessing.
9. Do not perform actions with hypothetical files. Use tools to find relevant files.`;

  exampleDynamicToolDefinition = `
\`\`\`tool_definition
TOOL_NAME: example_tool
TOOL_ARG: arg_1 (string, required)
Description of the first argument
END_ARG
TOOL_ARG: arg_2 (number, optional)
END_ARG
\`\`\``.trim();

  exampleDynamicToolCall = `
\`\`\`tool
TOOL_NAME: example_tool
BEGIN_ARG: arg_1
The value
of arg 1
END_ARG
BEGIN_ARG: arg_2
3
END_ARG
\`\`\``.trim();

  createSystemMessageExampleCall(
    toolName: string,
    prefix: string,
    exampleArgs: Array<[string, string | number]> = [],
  ) {
    let callExample = `\`\`\`tool
TOOL_NAME: ${toolName}`;

    // Add each argument dynamically
    for (const [argName, argValue] of exampleArgs) {
      callExample += `
BEGIN_ARG: ${argName}
${argValue}
END_ARG`;
    }

    callExample += `
\`\`\``;

    return `${prefix.trim()}
${callExample}`;
  }
}
