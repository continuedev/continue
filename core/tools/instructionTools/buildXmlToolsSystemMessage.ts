import { XMLBuilder } from "fast-xml-parser";
import { Tool } from "../..";
import { closeTag } from "./xmlToolsUtils";

export const TOOL_INSTRUCTIONS_TAG = "<tools_instructions>";
export const TOOL_DEFINITION_TAG = "<tool_definition>";
export const TOOL_DESCRIPTION_TAG = "<description>";
export const TOOL_CALL_TAG = "<tool_call>";
export const TOOL_NAME_TAG = "<name>";
export const TOOL_ARGS_TAG = "<args>";

const EXAMPLE_DYNAMIC_TOOL = `
${TOOL_DEFINITION_TAG}
    ${TOOL_NAME_TAG}example_tool${closeTag(TOOL_NAME_TAG)}
    ${TOOL_ARGS_TAG}
        <arg1>
            <description>First argument</description>
            <type>string</type>
            <required>true</required>
        </arg1>
        <arg2>
            <description>Second argument</description>
            <type>number</type>
            <required>false</required>
        </arg2>
    ${closeTag(TOOL_ARGS_TAG)}
${closeTag(TOOL_DEFINITION_TAG)}`.trim();

const EXAMPLE_TOOL_CALL = `
${TOOL_CALL_TAG}
    ${TOOL_NAME_TAG}example_tool${closeTag(TOOL_NAME_TAG)}
    ${TOOL_ARGS_TAG}
        <arg1>value1</arg1>
   ${closeTag(TOOL_ARGS_TAG)}
${closeTag(TOOL_CALL_TAG)}
`.trim();

function toolToXmlDefinition(tool: Tool): string {
  const builder = new XMLBuilder({
    ignoreAttributes: true,
    format: true,
    suppressEmptyNode: true,
  });

  const toolDefinition: {
    name: string;
    description?: string;
    args?: Record<string, any>;
  } = {
    name: tool.function.name,
  };

  if (tool.function.description) {
    toolDefinition.description = tool.function.description;
  }

  if (tool.function.parameters && "properties" in tool.function.parameters) {
    toolDefinition.args = {};
    for (const [key, value] of Object.entries(
      tool.function.parameters.properties,
    )) {
      toolDefinition.args[key] = value;
    }
  }

  return builder
    .build({
      tool_definition: toolDefinition,
    })
    .trim();
}

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

  let prompt = TOOL_INSTRUCTIONS_TAG;
  prompt += `You have access to several "tools" that you can use at any time to perform tasks for the User and interact with the IDE.`;
  prompt += `\nTo use a tool, respond with a ${TOOL_CALL_TAG}, specifying ${TOOL_NAME_TAG} and ${TOOL_ARGS_TAG} as shown in the provided examples below.`;

  if (withPredefinedMessage.length > 0) {
    prompt += `\n\nThe following tools are available to you:`;
    for (const tool of withPredefinedMessage) {
      prompt += "\n\n";
      prompt += tool.systemMessageDescription;
    }
  }

  if (withDynamicMessage.length > 0) {
    prompt += `Also, these additional tool definitions show other tools you can call with the same syntax:`;

    for (const tool of tools) {
      prompt += "\n\n";
      if (tool.systemMessageDescription) {
        prompt += tool.systemMessageDescription;
      } else {
        prompt += toolToXmlDefinition(tool);
      }
    }

    prompt += `For example, this tool definition:\n\n`;

    prompt += EXAMPLE_DYNAMIC_TOOL;

    prompt += "\n\nCan be called like this:\n";

    prompt += EXAMPLE_TOOL_CALL;
  }

  prompt += `\n\nIf it seems like the User's request could be solved with one of the tools, choose the BEST one for the job based on the user's request and the tool's description.`;
  prompt += `\nDo NOT use codeblocks for tool calls. You can only call one tool at a time.`;

  prompt += `\n${closeTag(TOOL_INSTRUCTIONS_TAG)}`;

  return prompt;
};

export function createSystemMessageExampleCall(
  name: string,
  instructions: string,
  argsExample: string = "",
) {
  return `${instructions}\n${TOOL_CALL_TAG}
${TOOL_NAME_TAG}${name}${closeTag(TOOL_NAME_TAG)}${
    !!argsExample
      ? `
  ${TOOL_ARGS_TAG}
    ${argsExample}
  ${closeTag(TOOL_ARGS_TAG)}
`.trim()
      : ""
  }
${closeTag(TOOL_CALL_TAG)}`;
}
