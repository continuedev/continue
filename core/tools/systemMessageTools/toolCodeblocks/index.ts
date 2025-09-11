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

  systemMessagePrefix = `You have access to several "tools" that you can use at any time to retrieve information and/or perform tasks for the User.
To use a tool, respond with a tool code block (\`\`\`tool) using the syntax shown in the examples below:`;

  systemMessageSuffix = `If it seems like the User's request could be solved with one of the tools, choose the BEST one for the job based on the user's request and the tool descriptions
Then send the \`\`\`tool codeblock (YOU call the tool, not the user). Always start the codeblock on a new line.
Do not perform actions with/for hypothetical files. Ask the user or use tools to deduce which files are relevant.
You can only call ONE tool at at time. The tool codeblock should be the last thing you say; stop your response after the tool codeblock.`;

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
