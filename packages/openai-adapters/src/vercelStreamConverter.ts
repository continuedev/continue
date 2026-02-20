/**
 * Converts Vercel AI SDK stream events to OpenAI ChatCompletionChunk format
 */

import type { ChatCompletionChunk } from "openai/resources/index";
import { chatChunk, chatChunkFromDelta, usageChatChunk } from "./util.js";

export type VercelStreamPart =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; text: string }
  | { type: "reasoning-end"; id: string }
  | ({ type: "source"; source?: any } & Record<string, any>)
  | { type: "file"; file: any }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: Record<string, unknown>;
      providerMetadata?: {
        google?: {
          thoughtSignature?: string;
        };
        vertex?: {
          thoughtSignature?: string;
        };
      };
    }
  | {
      type: "tool-input-start";
      id: string;
      toolName: string;
    }
  | {
      type: "tool-input-delta";
      id: string;
      delta: string;
    }
  | {
      type: "tool-input-end";
      id: string;
    }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | {
      type: "start-step";
    }
  | {
      type: "finish-step";
      response: any;
      usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens?: number;
      };
      finishReason: string;
    }
  | {
      type: "start";
    }
  | {
      type: "finish";
      finishReason: string;
      totalUsage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens?: number;
      };
    }
  | { type: "abort"; reason?: string }
  | { type: "error"; error: unknown }
  | { type: "raw"; rawValue: unknown };

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
        content: part.text,
        model,
      });

    case "reasoning-delta":
      return chatChunk({
        content: part.text,
        model,
      });

    case "tool-call": {
      const thoughtSignature =
        part.providerMetadata?.google?.thoughtSignature ??
        part.providerMetadata?.vertex?.thoughtSignature;
      return chatChunkFromDelta({
        delta: {
          tool_calls: [
            {
              index: 0,
              id: part.toolCallId,
              type: "function" as const,
              function: {
                name: part.toolName,
                arguments: JSON.stringify(part.input),
              },
              ...(thoughtSignature && {
                extra_content: {
                  google: {
                    thought_signature: thoughtSignature,
                  },
                },
              }),
            } as any,
          ],
        },
        model,
      });
    }

    case "tool-input-delta":
      return chatChunkFromDelta({
        delta: {
          tool_calls: [
            {
              index: 0,
              function: {
                arguments: part.delta,
              },
            },
          ],
        },
        model,
      });

    case "finish":
      if (part.totalUsage) {
        const inputTokens =
          typeof part.totalUsage.inputTokens === "number"
            ? part.totalUsage.inputTokens
            : 0;
        const outputTokens =
          typeof part.totalUsage.outputTokens === "number"
            ? part.totalUsage.outputTokens
            : 0;
        const totalTokens =
          typeof part.totalUsage.totalTokens === "number"
            ? part.totalUsage.totalTokens
            : inputTokens + outputTokens;

        const inputTokenDetails =
          (part.totalUsage as any).inputTokenDetails?.cacheReadTokens !==
          undefined
            ? {
                cached_tokens:
                  (part.totalUsage as any).inputTokenDetails.cacheReadTokens ??
                  0,
                cache_read_tokens:
                  (part.totalUsage as any).inputTokenDetails.cacheReadTokens ??
                  0,
                cache_write_tokens:
                  (part.totalUsage as any).inputTokenDetails.cacheWriteTokens ??
                  0,
              }
            : undefined;

        return usageChatChunk({
          model,
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens,
            ...(inputTokenDetails
              ? { prompt_tokens_details: inputTokenDetails as any }
              : {}),
          },
        });
      }
      return null;

    case "error":
      throw part.error;

    case "text-start":
    case "text-end":
    case "reasoning-start":
    case "reasoning-end":
    case "source":
    case "file":
    case "tool-input-start":
    case "tool-input-end":
    case "tool-result":
    case "start-step":
    case "finish-step":
    case "start":
    case "abort":
    case "raw":
      return null;

    default:
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
