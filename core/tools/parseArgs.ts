import { ToolCallDelta } from "..";

export function safeParseToolCallArgs(
  toolCall: ToolCallDelta,
): Record<string, any> {
  try {
    return JSON.parse(toolCall.function?.arguments?.trim() || "{}");
  } catch (e) {
    //console.error(
    //  `Failed to parse tool call arguments:\nTool call: ${toolCall.function?.name + " " + toolCall.id}\nArgs:${toolCall.function?.arguments}\n`,
    //);
    return {};
  }
}

export function getStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
): string {
  if (!args || !(argName in args) || typeof args[argName] !== "string") {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty"}. (type string)`,
    );
  }
  if (!allowEmpty && !args[argName].trim()) {
    throw new Error(`Argument ${argName} must not be empty`);
  }
  return args[argName];
}

export function getOptionalStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
) {
  if (typeof args?.[argName] === "undefined") {
    return undefined;
  }
  return getStringArg(args, argName, allowEmpty);
}

export function getBooleanArg(args: any, argName: string, required = false) {
  if (!args || !(argName in args)) {
    if (required) {
      throw new Error(`Argument \`${argName}\` is required (type boolean)`);
    } else {
      return undefined;
    }
  }
  if (typeof args[argName] === "string") {
    if (args[argName].toLowerCase() === "false") {
      return false;
    }
    if (args[argName].toLowerCase() === "true") {
      return true;
    }
  }
  if (typeof args[argName] !== "boolean") {
    throw new Error(`Argument \`${argName}\` must be a boolean true or false`);
  }
  return args[argName];
}
