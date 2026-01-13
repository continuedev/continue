/**
 * Converts Vercel AI SDK stream events to OpenAI ChatCompletionChunk format
 */

import type { ChatCompletionChunk } from "openai/resources/index";
import { chatChunk, chatChunkFromDelta, usageChatChunk } from "./util.js";

export type VercelStreamPart =
  | { type: "text-delta"; textDelta: string }
  | { type: "reasoning"; textDelta: string }
  | { type: "reasoning-signature"; signature: string }
  | { type: "redacted-reasoning"; data: string }
  | { type: "source"; source: any }
  | { type: "file"; name: string; content: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool-call-streaming-start";
      toolCallId: string;
      toolName: string;
    }
  | {
      type: "tool-call-delta";
      toolCallId: string;
      toolName: string;
      argsTextDelta: string;
    }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | {
      type: "step-start";
      messageId: string;
      request: any;
      warnings: any[];
    }
  | {
      type: "step-finish";
      messageId: string;
      request: any;
      response: any;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      finishReason: string;
    }
  | {
      type: "finish";
      finishReason: string;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { type: "error"; error: unknown };

export interface VercelStreamConverterOptions {
  model: string;
}

/**
 * Converts a Vercel AI SDK stream event to OpenAI ChatCompletionChunk format.
 * Returns null for events that don't map to OpenAI chunks (like step-start, step-finish, etc.)
 */
export function convertVercelStreamPart(
  part: VercelStreamPart,
  options: VercelStreamConverterOptions,
): ChatCompletionChunk | null {
  const { model } = options;

  switch (part.type) {
    case "text-delta":
      return chatChunk({
        content: part.textDelta,
        model,
      });

    case "reasoning":
      // For o1 models, reasoning is also treated as text content
      return chatChunk({
        content: part.textDelta,
        model,
      });

    case "tool-call":
      return chatChunkFromDelta({
        delta: {
          tool_calls: [
            {
              index: 0,
              id: part.toolCallId,
              type: "function" as const,
              function: {
                name: part.toolName,
                arguments: JSON.stringify(part.args),
              },
            },
          ],
        },
        model,
      });

    case "tool-call-delta":
      return chatChunkFromDelta({
        delta: {
          tool_calls: [
            {
              index: 0,
              function: {
                arguments: part.argsTextDelta,
              },
            },
          ],
        },
        model,
      });

    case "finish":
      // Emit usage from finish event if available
      // The finish event DOES contain the final usage in most cases
      if (part.usage) {
        const promptTokens =
          typeof part.usage.promptTokens === "number"
            ? part.usage.promptTokens
            : 0;
        const completionTokens =
          typeof part.usage.completionTokens === "number"
            ? part.usage.completionTokens
            : 0;
        const totalTokens =
          typeof part.usage.totalTokens === "number"
            ? part.usage.totalTokens
            : promptTokens + completionTokens;

        // Check for Anthropic-specific cache token details
        const promptTokensDetails =
          (part.usage as any).promptTokensDetails?.cachedTokens !== undefined
            ? {
                cached_tokens:
                  (part.usage as any).promptTokensDetails.cachedTokens ?? 0,
                cache_read_tokens:
                  (part.usage as any).promptTokensDetails.cachedTokens ?? 0,
                cache_write_tokens: 0,
              }
            : undefined;

        return usageChatChunk({
          model,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            ...(promptTokensDetails
              ? { prompt_tokens_details: promptTokensDetails as any }
              : {}),
          },
        });
      }
      return null;

    case "error":
      // Errors should be thrown, not converted to chunks
      throw part.error;

    // Events that don't map to OpenAI chunks - return null to skip
    case "reasoning-signature":
    case "redacted-reasoning":
    case "source":
    case "file":
    case "tool-call-streaming-start":
    case "tool-result":
    case "step-start":
    case "step-finish":
      return null;

    default:
      // Exhaustiveness check
      const _exhaustive: never = part;
      return null;
  }
}

/**
 * Async generator that converts Vercel AI SDK stream to OpenAI ChatCompletionChunk stream
 */
export async function* convertVercelStream(
  stream: AsyncIterable<VercelStreamPart>,
  options: VercelStreamConverterOptions,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  for await (const part of stream) {
    const chunk = convertVercelStreamPart(part, options);
    if (chunk !== null) {
      yield chunk;
    }
  }
}
