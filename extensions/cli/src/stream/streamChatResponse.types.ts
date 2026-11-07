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
   * Called after a round of tool calls has finished and before the next model
   * request. A returned item (a user message the person asked to steer with)
   * is appended to the conversation, so the model reads it in the same turn.
   */
  onToolBoundary?: () => Promise<ChatHistoryItem | undefined>;
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
