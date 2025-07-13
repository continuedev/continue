import { Tool } from "../..";

export const TOOL_INSTRUCTIONS_TAG = "TOOL_USE_INSTRUCTIONS";
export const TOOL_DEFINITION_TAG = "TOOL_DEFINITION";
export const TOOL_DESCRIPTION_TAG = "DESCRIPTION";

const EXAMPLE_DYNAMIC_TOOL = `
\`\`\`tool
TOOL_NAME: example_tool
BEGIN_ARG: arg1
First argument (string, required)
END_ARG
BEGIN_ARG: arg2
Second argument (number, optional)
END_ARG
\`\`\``.trim();

const EXAMPLE_TOOL_CALL = `
\`\`\`tool
TOOL_NAME: example_tool
BEGIN_ARG: arg1
value1
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
// function toolToToolDefinition(tool: Tool): string {
//   let toolDefinition = `\`\`\`tool\nTOOL_NAME: ${tool.function.name}\n`;

//   if (tool.function.description) {
//     toolDefinition += `DESCRIPTION: ${tool.function.description}\n`;
//   }

//   if (tool.function.parameters && "properties" in tool.function.parameters) {
//     for (const [key, value] of Object.entries(
//       tool.function.parameters.properties,
//     )) {
//       const isRequired = tool.function.parameters.required?.includes(key);
//       const type = value.type || "string";
//       const description = value.description || "";

//       toolDefinition += `BEGIN_ARG: ${key}\n`;
//       if (description) {
//         toolDefinition += `${description} (${type}${isRequired ? ", required" : ", optional"})\n`;
//       } else {
//         toolDefinition += `${type}${isRequired ? ", required" : ", optional"}\n`;
//       }
//       toolDefinition += `END_ARG\n`;
//     }
//   }

//   toolDefinition += `\`\`\``;
//   return toolDefinition.trim();
// }

export const generateToolsSystemMessage = (tools: Tool[]) => {
  if (tools.length === 0) {
    return undefined;
  }
  const withPredefinedMessage = tools.filter(
    (tool) => !!tool.systemMessageDescription,
  );

  const withDynamicMessage = tools.filter(
    (tool) => !tool.systemMessageDescription,
  );

  let prompt = `--- ${TOOL_INSTRUCTIONS_TAG} ---\n`;
  prompt += `You have access to several "tools" that you can use at any time to perform tasks for the User and interact with the IDE.`;
  prompt += `\nTo use a tool, respond with a code block using the tool syntax as shown in the examples below:`;

  if (withPredefinedMessage.length > 0) {
    prompt += `\n\nThe following tools are available to you:`;
    for (const tool of withPredefinedMessage) {
      prompt += "\n\n";
      prompt += tool.systemMessageDescription;
    }
  }

  // if (withDynamicMessage.length > 0) {
  //   prompt += `\n\nAlso, these additional tool definitions show other tools you can call with the same syntax:`;

  //   for (const tool of tools) {
  //     prompt += "\n\n";
  //     if (tool.systemMessageDescription) {
  //       prompt += tool.systemMessageDescription;
  //     } else {
  //       prompt += toolToToolDefinition(tool);
  //     }
  //   }

  //   prompt += `\n\nFor example, this tool definition:\n\n`;

  //   prompt += EXAMPLE_DYNAMIC_TOOL;

  //   prompt += "\n\nCan be called like this:\n";

  //   prompt += EXAMPLE_TOOL_CALL;
  // }

  prompt += `\n\nIf it seems like the User's request could be solved with one of the tools, choose the BEST one for the job based on the user's request and the tool's description.`;
  prompt += `\nYou are the one who sends the tool call, not the user. You can only call one tool at a time.`;

  prompt += `\n--- END ${TOOL_INSTRUCTIONS_TAG} ---`;

  return prompt;
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
