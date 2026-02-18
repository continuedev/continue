/**
 * Converts OpenAI tool format to Vercel AI SDK format
 */

import type { ChatCompletionCreateParams } from "openai/resources/index.js";

/**
 * Recursively transforms schemas to be OpenAI strict mode compatible:
 * - Adds additionalProperties: false to all object schemas
 * - Ensures all properties are listed in the required array
 */
function makeOpenAIStrictCompatible(schema: any): any {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const result = { ...schema };

  if (result.type === "object") {
    result.additionalProperties = false;

    if (result.properties) {
      const propertyKeys = Object.keys(result.properties);
      result.required = propertyKeys;

      result.properties = Object.fromEntries(
        Object.entries(result.properties).map(([key, value]) => [
          key,
          makeOpenAIStrictCompatible(value),
        ]),
      );
    }
  }

  if (result.items) {
    result.items = makeOpenAIStrictCompatible(result.items);
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(makeOpenAIStrictCompatible);
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(makeOpenAIStrictCompatible);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(makeOpenAIStrictCompatible);
  }

  return result;
}

/**
 * Converts OpenAI tool format to Vercel AI SDK format.
 *
 * OpenAI format: { type: "function", function: { name, description, parameters: JSONSchema } }
 * Vercel format: { [toolName]: { description, parameters: aiJsonSchema(JSONSchema) } }
 *
 * @param openaiTools - Array of OpenAI tools or undefined
 * @returns Object with tool names as keys, or undefined if no tools
 */
export async function convertToolsToVercelFormat(
  openaiTools?: ChatCompletionCreateParams["tools"],
): Promise<Record<string, any> | undefined> {
  if (!openaiTools || openaiTools.length === 0) {
    return undefined;
  }

  const { jsonSchema: aiJsonSchema } = await import("ai");

  const vercelTools: Record<string, any> = {};
  for (const tool of openaiTools) {
    if (tool.type === "function") {
      const parameters = makeOpenAIStrictCompatible(
        tool.function.parameters ?? { type: "object", properties: {} },
      );
      vercelTools[tool.function.name] = {
        description: tool.function.description,
        parameters: aiJsonSchema(parameters),
      };
    }
  }

  return Object.keys(vercelTools).length > 0 ? vercelTools : undefined;
}
