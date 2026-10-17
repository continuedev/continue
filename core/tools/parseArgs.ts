import { ToolCallDelta } from "..";

export function safeParseToolCallArgs(
  toolCall: ToolCallDelta,
): Record<string, any> {
  const args = toolCall.function?.arguments;

  if (
    args &&
    typeof args === "object" &&
    !Array.isArray(args) &&
    Object.keys(args).length > 0
  ) {
    return args;
  }

  try {
    return JSON.parse(toolCall.function?.arguments?.trim() || "{}");
  } catch (e) {
    //console.error(
    //  `Failed to parse tool call arguments:\nTool call: ${toolCall.function?.name + " " + toolCall.id}\nArgs:${toolCall.function?.arguments}\n`,
    //);
    return {};
  }
}

function schemaMatchesType(
  propSchema: Record<string, any>,
  targetType: string,
): boolean {
  if (propSchema.type === targetType) {
    return true;
  }
  if (Array.isArray(propSchema.type) && propSchema.type.includes(targetType)) {
    return true;
  }
  if (Array.isArray(propSchema.anyOf)) {
    return propSchema.anyOf.some(
      (sub: any) =>
        typeof sub === "object" &&
        sub !== null &&
        schemaMatchesType(sub, targetType),
    );
  }
  if (Array.isArray(propSchema.oneOf)) {
    return propSchema.oneOf.some(
      (sub: any) =>
        typeof sub === "object" &&
        sub !== null &&
        schemaMatchesType(sub, targetType),
    );
  }
  return false;
}

/**
 * Coerce parsed args to match the tool's input schema types.
 *
 * Models and parsers frequently return argument values with mismatched types:
 * - String parameters containing valid JSON get parsed into objects/arrays;
 *   these need to be re-stringified.
 * - Array/object parameters containing serialized JSON strings (common with
 *   Ollama/Qwen tool calls); these need to be parsed into actual arrays/objects.
 * - Boolean/number parameters formatted as strings (e.g. "true", "false", "42");
 *   these need to be coerced to primitive booleans and numbers.
 */
export function coerceArgsToSchema(
  args: Record<string, any>,
  schema?: Record<string, any>,
): Record<string, any> {
  if (!schema?.properties) {
    return args;
  }

  const coerced = { ...args };
  for (const [key, value] of Object.entries(coerced)) {
    const propSchema = schema.properties[key];
    if (!propSchema || typeof propSchema !== "object") {
      continue;
    }

    if (
      schemaMatchesType(propSchema, "string") &&
      !schemaMatchesType(propSchema, "object") &&
      !schemaMatchesType(propSchema, "array") &&
      typeof value === "object" &&
      value !== null
    ) {
      try {
        coerced[key] = JSON.stringify(value);
      } catch {
        // leave as-is if stringify fails
      }
    } else if (
      schemaMatchesType(propSchema, "array") &&
      typeof value === "string"
    ) {
      try {
        const parsed = JSON.parse(value.trim());
        if (Array.isArray(parsed)) {
          coerced[key] = parsed;
        }
      } catch {
        // leave as-is if parsing fails
      }
    } else if (
      schemaMatchesType(propSchema, "object") &&
      !schemaMatchesType(propSchema, "string") &&
      typeof value === "string"
    ) {
      try {
        const parsed = JSON.parse(value.trim());
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          coerced[key] = parsed;
        }
      } catch {
        // leave as-is if parsing fails
      }
    } else if (
      schemaMatchesType(propSchema, "boolean") &&
      !schemaMatchesType(propSchema, "string") &&
      typeof value === "string"
    ) {
      const lower = value.trim().toLowerCase();
      if (lower === "true") {
        coerced[key] = true;
      } else if (lower === "false") {
        coerced[key] = false;
      }
    } else if (
      (schemaMatchesType(propSchema, "number") ||
        schemaMatchesType(propSchema, "integer")) &&
      !schemaMatchesType(propSchema, "string") &&
      typeof value === "string"
    ) {
      const trimmed = value.trim();
      if (trimmed !== "" && !isNaN(Number(trimmed))) {
        const num = Number(trimmed);
        coerced[key] =
          schemaMatchesType(propSchema, "integer") &&
          !schemaMatchesType(propSchema, "number")
            ? Math.floor(num)
            : num;
      }
    }
  }

  return coerced;
}

export function getStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
): string {
  if (!args || !(argName in args)) {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty or whitespace-only"}. (type string)`,
    );
  }

  let value = args[argName];

  // Handle case where JSON was parsed into an object by the tool call parser.
  // If the arguments to the tool call are valid JSON (e.g. the model attempts to create a .json file)
  // the earlier call to JSON.parse() will have deeply parsed the returned arguments.
  // If that has happened, convert back to string.
  if (typeof value === "object" && value !== null) {
    try {
      value = JSON.stringify(value);
      return value;
    } catch (e) {
      //Swallow this, because it might be fine later.
    }
  }

  if (typeof value !== "string") {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty or whitespace-only"}. (type string)`,
    );
  }

  if (!allowEmpty && !value.trim()) {
    throw new Error(`Argument ${argName} must not be empty or whitespace-only`);
  }

  return value;
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

export function getNumberArg(args: any, argName: string): number {
  if (!args || !(argName in args)) {
    throw new Error(`Argument \`${argName}\` is required (type number)`);
  }
  const value = args[argName];
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Argument \`${argName}\` must be a valid number`);
    }
    return parsed;
  }
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`Argument \`${argName}\` must be a valid number`);
  }
  return Math.floor(value); // Ensure integer for line numbers (supports negative numbers)
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
