import { Tool } from "../..";
import { closeTag } from "./systemToolUtils";

export const TOOL_INSTRUCTIONS_TAG = "<tool_use_instructions>";
export const TOOL_DEFINITION_TAG = "TOOL_DEFINITION";
export const TOOL_DESCRIPTION_TAG = "DESCRIPTION";

const EXAMPLE_DYNAMIC_TOOL = `
\`\`\`tool_definition
TOOL_NAME: example_tool
TOOL_ARG: arg_1 (string, required)
Description of the first argument
END_ARG
TOOL_ARG: arg_2 (number, optional)
END_ARG
\`\`\``.trim();

const EXAMPLE_DYNAMIC_TOOL_CALL = `
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

export function createSystemMessageExampleCall(
  name: string,
  instructions: string,
  args: Array<[string, string]> = [],
) {
  let callExample = `\`\`\`tool
TOOL_NAME: ${name}`;

  // Add each argument dynamically
  for (const [argName, argValue] of args) {
    callExample += `
BEGIN_ARG: ${argName}
${argValue}
END_ARG`;
  }

  callExample += `
\`\`\``;

  return `${instructions.trim()}
${callExample}`;
}

function toolToSystemToolDefinition(tool: Tool): string {
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

export const generateToolsSystemMessage = (tools: Tool[]): string => {
  if (tools.length === 0) {
    return "";
  }
  const withPredefinedMessage = tools.filter(
    (tool) => !!tool.systemMessageDescription,
  );

  const withDynamicMessage = tools.filter(
    (tool) => !tool.systemMessageDescription,
  );

  const instructions: string[] = [];
  instructions.push(TOOL_INSTRUCTIONS_TAG);
  instructions.push(
    `You have access to several "tools" that you can use at any time to retrieve information and/or perform tasks for the User.`,
  );
  instructions.push(
    `To use a tool, respond with a tool code block (\`\`\`tool) using the syntax shown in the examples below:`,
  );

  if (withPredefinedMessage.length > 0) {
    instructions.push(`\nThe following tools are available to you:`);
    for (const tool of withPredefinedMessage) {
      instructions.push(`\n${tool.systemMessageDescription}`);
    }
  }

  if (withDynamicMessage.length > 0) {
    instructions.push(
      `\nAlso, these additional tool definitions show other tools you can call with the same syntax:`,
    );

    for (const tool of tools) {
      try {
        const definition = toolToSystemToolDefinition(tool);
        instructions.push(`\n${definition}`);
      } catch (e) {
        console.error(
          "Failed to convert tool to system message tool:\n" +
            JSON.stringify(tool),
        );
      }
    }

    instructions.push(`\nFor example, this tool definition:\n`);
    instructions.push(EXAMPLE_DYNAMIC_TOOL);
    instructions.push("\nCan be called like this:\n");
    instructions.push(EXAMPLE_DYNAMIC_TOOL_CALL);
  }

  instructions.push(
    `\nIf it seems like the User's request could be solved with one of the tools, choose the BEST one for the job based on the user's request and the tool descriptions`,
  );
  instructions.push(
    `Then send the \`\`\`tool codeblock (YOU call the tool, not the user). Always start the codeblock on a new line.`,
  );
  instructions.push(
    `Do not perform actions with/for hypothetical files. Ask the user or use tools to deduce which files are relevant.`,
  );
  instructions.push(
    `You can only call ONE tool at at time. The tool codeblock should be the last thing you say; stop your response after the tool codeblock.`,
  );

  instructions.push(`${closeTag(TOOL_INSTRUCTIONS_TAG)}`);
  return instructions.join("\n");
};

export function addSystemMessageToolsToSystemMessage(
  baseSystemMessage: string,
  systemMessageTools: Tool[],
): string {
  let systemMessage = baseSystemMessage;
  if (systemMessageTools.length > 0) {
    const toolsSystemMessage = generateToolsSystemMessage(systemMessageTools);
    systemMessage += `\n\n${toolsSystemMessage}`;
  }

  return systemMessage;
}
