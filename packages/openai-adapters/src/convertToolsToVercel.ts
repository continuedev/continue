/**
 * Converts OpenAI tool format to Vercel AI SDK format
 */

import type { ChatCompletionCreateParams } from "openai/resources/index.js";

/**
 * Converts OpenAI tool format to Vercel AI SDK format.
 *
 * OpenAI format: { type: "function", function: { name, description, parameters: JSONSchema } }
 * Vercel format (AI SDK v5): { [toolName]: { description, inputSchema: aiJsonSchema(JSONSchema) } }
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
      vercelTools[tool.function.name] = {
        description: tool.function.description,
        inputSchema: aiJsonSchema(
          tool.function.parameters ?? { type: "object", properties: {} },
        ),
      };
    }
  }

  return Object.keys(vercelTools).length > 0 ? vercelTools : undefined;
}
