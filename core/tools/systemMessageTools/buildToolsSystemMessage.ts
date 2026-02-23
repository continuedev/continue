import { Tool } from "../..";
import { closeTag } from "./systemToolUtils";
import { SystemMessageToolsFramework } from "./types";

export const TOOL_INSTRUCTIONS_TAG = "<tool_use_instructions>";

export const generateToolsSystemMessage = (
  tools: Tool[],
  framework: SystemMessageToolsFramework,
): string => {
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
  instructions.push(framework.systemMessagePrefix);

  if (withPredefinedMessage.length > 0) {
    instructions.push(`\nThe following tools are available to you:`);
    for (const tool of withPredefinedMessage) {
      const definition = framework.createSystemMessageExampleCall(
        tool.function.name,
        tool.systemMessageDescription!.prefix,
        tool.systemMessageDescription!.exampleArgs,
      );
      instructions.push(`\n${definition}`);
    }
  }

  if (withDynamicMessage.length > 0) {
    instructions.push(
      `\nAlso, these additional tool definitions show other tools you can call with the same syntax:`,
    );

    for (const tool of tools) {
      try {
        const definition = framework.toolToSystemToolDefinition(tool);
        instructions.push(`\n${definition}`);
      } catch (e) {
        console.error(
          "Failed to convert tool to system message tool:\n" +
            JSON.stringify(tool),
        );
      }
    }

    instructions.push(`\nFor example, this tool definition:\n`);
    instructions.push(framework.exampleDynamicToolDefinition);
    instructions.push("\nCan be called like this:\n");
    instructions.push(framework.exampleDynamicToolCall);
  }

  instructions.push("\n" + framework.systemMessageSuffix);

  instructions.push(`${closeTag(TOOL_INSTRUCTIONS_TAG)}`);
  return instructions.join("\n");
};

export function addSystemMessageToolsToSystemMessage(
  framework: SystemMessageToolsFramework,
  baseSystemMessage: string,
  systemMessageTools: Tool[],
): string {
  let systemMessage = baseSystemMessage;
  if (systemMessageTools.length > 0) {
    const toolsSystemMessage = generateToolsSystemMessage(
      systemMessageTools,
      framework,
    );
    systemMessage += `\n\n${toolsSystemMessage}`;
  }

  return systemMessage;
}
