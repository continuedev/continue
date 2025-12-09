/**
 * Converts OpenAI tool format to Vercel AI SDK format
 */

import type { ChatCompletionCreateParams } from "openai/resources/index.js";
import { jsonSchema as aiJsonSchema } from "ai";

/**
 * Converts OpenAI tool format to Vercel AI SDK format.
 *
 * OpenAI format: { type: "function", function: { name, description, parameters: JSONSchema } }
 * Vercel format: { [toolName]: { description, parameters: aiJsonSchema(JSONSchema) } }
 *
 * @param openaiTools - Array of OpenAI tools or undefined
 * @returns Object with tool names as keys, or undefined if no tools
 */
export function convertToolsToVercelFormat(
  openaiTools?: ChatCompletionCreateParams["tools"],
): Record<string, any> | undefined {
  if (!openaiTools || openaiTools.length === 0) {
    return undefined;
  }

  const vercelTools: Record<string, any> = {};
  for (const tool of openaiTools) {
    if (tool.type === "function") {
      vercelTools[tool.function.name] = {
        description: tool.function.description,
        parameters: aiJsonSchema(tool.function.parameters as any),
      };
    }
  }

  return Object.keys(vercelTools).length > 0 ? vercelTools : undefined;
}
