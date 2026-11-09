import { CompletionOptions } from "@continuedev/config-yaml";
import type { ChatHistoryItem, ToolStatus } from "core/index.js";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources.mjs";

import { ToolCallPreview } from "../tools/types.js";

export interface StreamCallbacks {
  onContent?: (content: string) => void;
  onContentComplete?: (content: string) => void;
  onToolStart?: (toolName: string, toolArgs?: any) => void;
  onToolResult?: (result: string, toolName: string, status: ToolStatus) => void;
  onToolError?: (error: string, toolName?: string) => void;
  onToolPermissionRequest?: (
    toolName: string,
    toolArgs: any,
    requestId: string,
    preview?: ToolCallPreview[],
  ) => void;
  onSystemMessage?: (message: string) => void;
  /**
   * A short notice about the request for the person, not the model: for
   * example that the reply was cut off at the output limit. The TUI shows it
   * on its status line; `cn serve` writes it to its log.
   */
  onStatusMessage?: (message: string) => void;
  /**
   * Called after a round of tool calls has finished and before the next model
   * request. A returned item (a user message the person asked to steer with)
   * is appended to the conversation, so the model reads it in the same turn.
   */
  onToolBoundary?: () => Promise<ChatHistoryItem | undefined>;
  /**
   * True while the model's reply streams, false once it has ended (before any
   * of its tool calls run). "Steer now" interrupts only while it is true, so a
   * running tool is never cut short.
   */
  onModelStreaming?: (streaming: boolean) => void;
}

export function getDefaultCompletionOptions(
  opts?: CompletionOptions,
): Partial<ChatCompletionCreateParamsStreaming> {
  if (!opts) return {};
  return {
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    frequency_penalty: opts.frequencyPenalty,
    presence_penalty: opts.presencePenalty,
    top_p: opts.topP,
  };
}
