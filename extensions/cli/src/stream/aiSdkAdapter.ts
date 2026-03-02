/**
 * AI SDK Adapter
 *
 * This module bridges the CLI's existing tool system to the Vercel AI SDK.
 * It converts our Tool definitions into AI SDK tool() calls, and critically,
 * handles multipart tool results (images) via toModelOutput.
 *
 * ## Usage
 *
 * Replace the current streamChatResponse loop with:
 *
 *   import { streamText, stepCountIs } from "ai";
 *   import { convertToolsForAiSdk } from "./aiSdkAdapter.js";
 *
 *   const tools = await convertToolsForAiSdk(isHeadless);
 *   const result = streamText({
 *     model: createOpenAICompatible(...),  // or anthropic(), etc.
 *     messages,
 *     tools,
 *     stopWhen: stepCountIs(50),
 *   });
 *
 * ## How image reading works
 *
 * 1. Model calls Read tool with { filepath: "screenshot.png" }
 * 2. Our readFileTool.run() detects it's an image, returns a MultipartToolResult
 *    with text description + base64 image data
 * 3. The AI SDK calls toModelOutput(), which converts the MultipartToolResult
 *    into AI SDK content parts: [{ type: "text", ... }, { type: "image", ... }]
 * 4. The AI SDK sends these as multipart tool_result content to the model
 * 5. The model can now "see" the image
 */

// NOTE: Uncomment the imports below once the `ai` package is added as a dependency.
// import { tool, type ToolSet } from "ai";
// import { z } from "zod";

import { getAllAvailableTools, executeToolCallRaw } from "../tools/index.js";
import {
  type Tool,
  type ToolResult,
  isMultipartToolResult,
  extractTextFromToolResult,
} from "../tools/types.js";
import { logger } from "../util/logger.js";

/**
 * Represents the AI SDK's ToolResultOutput content part.
 * This is what toModelOutput returns.
 *
 * When the `ai` package is installed, this should be replaced with:
 *   import type { ToolResultOutput } from "ai";
 */
type AiSdkToolResultContent = Array<
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
>;

/**
 * Convert a ToolResult to AI SDK tool result content.
 *
 * For string results: returns [{ type: "text", text: "..." }]
 * For multipart results: returns text and image parts that the model can see.
 */
export function toolResultToAiSdkContent(
  result: ToolResult,
): AiSdkToolResultContent {
  if (typeof result === "string") {
    return [{ type: "text", text: result }];
  }

  return result.parts.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text ?? "" };
    }
    return {
      type: "image" as const,
      data: part.data ?? "",
      mimeType: part.mimeType ?? "image/png",
    };
  });
}

/**
 * Convert our internal Tool[] to AI SDK ToolSet.
 *
 * This is the main entry point. Call this instead of getRequestTools()
 * when using the AI SDK path.
 *
 * Example (once `ai` is installed):
 *
 * ```ts
 * import { tool } from "ai";
 * import { z } from "zod";
 *
 * export async function convertToolsForAiSdk(
 *   isHeadless: boolean,
 * ): Promise<ToolSet> {
 *   const tools = await getAllAvailableTools(isHeadless);
 *   const toolSet: ToolSet = {};
 *
 *   for (const t of tools) {
 *     toolSet[t.name] = tool({
 *       description: t.description,
 *       inputSchema: convertParametersToZod(t.parameters),
 *       execute: async (input, { toolCallId }) => {
 *         const rawResult = await t.run(input, {
 *           toolCallId,
 *           parallelToolCallCount: 1,
 *         });
 *         return rawResult;
 *       },
 *       // This is the key: convert multipart results to AI SDK format
 *       // so the model receives image content in tool_result messages
 *       toModelOutput: ({ output }) => {
 *         return toolResultToAiSdkContent(output);
 *       },
 *     });
 *   }
 *
 *   return toolSet;
 * }
 * ```
 *
 * The critical piece is `toModelOutput` — without it, the AI SDK would
 * JSON.stringify the result object. With it, image parts become actual
 * image content blocks in the API request to the model.
 */

/**
 * Minimal reference implementation that works without the `ai` package.
 * This demonstrates the conversion pattern and can be used for testing.
 *
 * Returns a plain object mapping tool names to their config, matching
 * the shape that the AI SDK expects.
 */
export async function convertToolsForAiSdk(isHeadless: boolean): Promise<
  Record<
    string,
    {
      description: string;
      parameters: Record<string, unknown>;
      execute: (input: any, options: { toolCallId: string }) => Promise<ToolResult>;
      toModelOutput: (opts: { output: ToolResult }) => AiSdkToolResultContent;
    }
  >
> {
  const internalTools = await getAllAvailableTools(isHeadless);
  const toolSet: Record<string, any> = {};

  for (const t of internalTools) {
    toolSet[t.name] = {
      description: t.description,
      parameters: t.parameters,
      execute: async (
        input: any,
        { toolCallId }: { toolCallId: string },
      ): Promise<ToolResult> => {
        logger.debug("AI SDK executing tool", { name: t.name, input });

        // Run preprocessing if the tool has it
        let args = input;
        if (t.preprocess) {
          const preprocessed = await t.preprocess(input);
          args = preprocessed.args;
        }

        const result = await t.run(args, {
          toolCallId,
          parallelToolCallCount: 1,
        });

        return result;
      },
      toModelOutput: ({ output }: { output: ToolResult }) => {
        return toolResultToAiSdkContent(output);
      },
    };
  }

  return toolSet;
}
