import { FimCreateParamsStreaming } from "@continuedev/openai-adapters/dist/apis/base";
import {
  ChatCompletion,
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  CompletionCreateParams,
} from "openai/resources/index";

import {
  ChatMessage,
  CompletionOptions,
  TextMessagePart,
  ThinkingChatMessage,
} from "..";

function appendReasoningFieldsIfSupported(
  msg: ChatCompletionAssistantMessageParam & {
    reasoning?: string;
    reasoning_details?: any[];
  },
  options: CompletionOptions,
  prevMessage?: ChatMessage,
  providerFlags?: {
    includeReasoningField?: boolean;
    includeReasoningDetailsField?: boolean;
  },
) {
  if (!prevMessage || prevMessage.role !== "thinking") return;

  const includeReasoning = !!providerFlags?.includeReasoningField;
  const includeReasoningDetails = !!providerFlags?.includeReasoningDetailsField;
  if (!includeReasoning && !includeReasoningDetails) return;

  const reasoningDetailsValue =
    prevMessage.reasoning_details ||
    (prevMessage.signature
      ? [{ signature: prevMessage.signature }]
      : undefined);

  // Claude-specific safeguard: prevent errors when switching to Claude after another model.
  // Claude requires a signed reasoning_details block; if missing, we must omit both fields.
  // This check is done before adding any fields to avoid deletes.
  if (
    includeReasoningDetails &&
    options.model.includes("claude") &&
    !(
      Array.isArray(reasoningDetailsValue) &&
      reasoningDetailsValue.some((d) => d && d.signature)
    )
  ) {
    console.warn(
      "Omitting reasoning fields for Claude: no signature present in reasoning_details",
    );
    return;
  }

  if (includeReasoningDetails && reasoningDetailsValue) {
    msg.reasoning_details = reasoningDetailsValue || [];
  }
  if (includeReasoning) {
    msg.reasoning = prevMessage.content as string;
  }
}

export function toChatMessage(
  message: ChatMessage,
  options: CompletionOptions,
  prevMessage?: ChatMessage,
  providerFlags?: {
    includeReasoningField?: boolean;
    includeReasoningDetailsField?: boolean;
  },
): ChatCompletionMessageParam | null {
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }
  if (message.role === "system") {
    return {
      role: "system",
      content: message.content,
    };
  }
  if (message.role === "thinking") {
    // Return null - thinking messages are merged into following assistant messages
    return null;
  }

  if (message.role === "assistant") {
    // Base assistant message
    const msg: ChatCompletionAssistantMessageParam & {
      reasoning?: string;
      reasoning_details?: {
        [key: string]: any;
        signature?: string | undefined;
      }[];
    } = {
      role: "assistant",
      content:
        typeof message.content === "string"
          ? message.content || " " // LM Studio (and other providers) don't accept empty content
          : message.content
              .filter((part) => part.type === "text")
              .map((part) => part as TextMessagePart),
    };

    // Add tool calls if present
    if (message.toolCalls) {
      msg.tool_calls = message.toolCalls.map((toolCall) => ({
        id: toolCall.id!,
        type: toolCall.type!,
        function: {
          name: toolCall.function?.name!,
          arguments: toolCall.function?.arguments || "{}",
        },
      }));
    }

    // Preserving reasoning blocks
    appendReasoningFieldsIfSupported(
      msg as any,
      options,
      prevMessage,
      providerFlags,
    );

    return msg as ChatCompletionMessageParam;
  } else {
    if (typeof message.content === "string") {
      return {
        role: "user",
        content: message.content ?? " ", // LM Studio (and other providers) don't accept empty content
      };
    }

    // If no multi-media is in the message, just send as text
    // for compatibility with OpenAI-"compatible" servers
    // that don't support multi-media format
    return {
      role: "user",
      content: !message.content.some((item) => item.type !== "text")
        ? message.content
            .map((item) => (item as TextMessagePart).text)
            .join("") || " "
        : message.content.map((part) => {
            if (part.type === "imageUrl") {
              return {
                type: "image_url" as const,
                image_url: {
                  url: part.imageUrl.url,
                  detail: "auto" as const,
                },
              };
            }
            return part;
          }),
    };
  }
}

export function toChatBody(
  messages: ChatMessage[],
  options: CompletionOptions,
  providerFlags?: {
    includeReasoningField?: boolean;
    includeReasoningDetailsField?: boolean;
  },
): ChatCompletionCreateParams {
  const params: ChatCompletionCreateParams = {
    messages: messages
      .map((m, index) =>
        toChatMessage(m, options, messages[index - 1], providerFlags),
      )
      .filter((m) => m !== null) as ChatCompletionMessageParam[],
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    top_p: options.topP,
    frequency_penalty: options.frequencyPenalty,
    presence_penalty: options.presencePenalty,
    stream: options.stream ?? true,
    stop: options.stop,
    prediction: options.prediction,
    tool_choice: options.toolChoice,
  };

  if (options.tools?.length) {
    params.tools = options.tools
      .filter((tool) => !tool.type || tool.type === "function")
      .map((tool) => ({
        type: tool.type,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
          strict: tool.function.strict,
        },
      }));
  }

  return params;
}

export function toCompleteBody(
  prompt: string,
  options: CompletionOptions,
): CompletionCreateParams {
  return {
    prompt,
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    top_p: options.topP,
    frequency_penalty: options.frequencyPenalty,
    presence_penalty: options.presencePenalty,
    stream: options.stream ?? true,
    stop: options.stop,
  };
}

export function toFimBody(
  prefix: string,
  suffix: string,
  options: CompletionOptions,
): FimCreateParamsStreaming {
  return {
    model: options.model,
    prompt: prefix,
    suffix,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    top_p: options.topP,
    frequency_penalty: options.frequencyPenalty,
    presence_penalty: options.presencePenalty,
    stop: options.stop,
    stream: true,
  } as any;
}

export function fromChatResponse(response: ChatCompletion): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const message = response.choices[0].message as ChatCompletionMessage & {
    reasoning?: string;
    reasoning_content?: string;
    reasoning_details?: {
      signature?: string;
      [key: string]: any;
    }[];
  };

  // Check for reasoning content first (similar to fromChatCompletionChunk)
  if (message.reasoning_content || message.reasoning) {
    const thinkingMessage: ChatMessage = {
      role: "thinking",
      content: (message as any).reasoning_content || (message as any).reasoning,
    };

    // Preserve reasoning_details if present
    if (message.reasoning_details) {
      thinkingMessage.reasoning_details = message.reasoning_details;
      // Extract signature from reasoning_details if available
      if (message.reasoning_details[0]?.signature) {
        thinkingMessage.signature = message.reasoning_details[0].signature;
      }
    }

    messages.push(thinkingMessage);
  }

  // Then add the assistant message
  const toolCall = message.tool_calls?.[0];
  if (toolCall) {
    messages.push({
      role: "assistant",
      content: "",
      toolCalls: message.tool_calls
        ?.filter((tc) => !tc.type || tc.type === "function")
        .map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: (tc as any).function?.name,
            arguments: (tc as any).function?.arguments,
          },
        })),
    });
  } else {
    messages.push({
      role: "assistant",
      content: message.content ?? "",
    });
  }

  return messages;
}

export function fromChatCompletionChunk(
  chunk: ChatCompletionChunk,
): ChatMessage | undefined {
  const delta = chunk.choices?.[0]?.delta as
    | (ChatCompletionChunk.Choice.Delta & {
        reasoning?: string;
        reasoning_content?: string;
        reasoning_details?: {
          signature?: string;
        }[];
      })
    | undefined;

  if (delta?.content) {
    return {
      role: "assistant",
      content: delta.content,
    };
  } else if (delta?.tool_calls) {
    const toolCalls = delta?.tool_calls
      .filter((tool_call) => !tool_call.type || tool_call.type === "function")
      .map((tool_call) => ({
        id: tool_call.id,
        type: "function" as const,
        function: {
          name: (tool_call as any).function?.name,
          arguments: (tool_call as any).function?.arguments,
        },
      }));

    if (toolCalls.length > 0) {
      return {
        role: "assistant",
        content: "",
        toolCalls,
      };
    }
  } else if (
    delta?.reasoning_content ||
    delta?.reasoning ||
    delta?.reasoning_details?.length
  ) {
    const message: ThinkingChatMessage = {
      role: "thinking",
      content: delta.reasoning_content || delta.reasoning || "",
      signature: delta?.reasoning_details?.[0]?.signature,
      reasoning_details: delta?.reasoning_details as any[],
    };
    return message;
  }

  return undefined;
}

export function mergeReasoningDetails(
  existing: any[] | undefined,
  delta: any[] | undefined,
): any[] | undefined {
  if (!delta) return existing;
  if (!existing) return delta;

  const result = [...existing];

  for (const deltaItem of delta) {
    // Skip items without a type
    if (!deltaItem.type) {
      continue;
    }

    // Find existing item with the same type
    const existingIndex = result.findIndex(
      (item) => item.type === deltaItem.type,
    );

    if (existingIndex === -1) {
      // No existing item with this type, add new item
      result.push({ ...deltaItem });
    } else {
      // Merge with existing item of the same type
      const existingItem = result[existingIndex];

      for (const [key, value] of Object.entries(deltaItem)) {
        if (value === null || value === undefined) continue;

        if (key === "text" || key === "signature" || key === "summary") {
          // Concatenate text and signature fields
          existingItem[key] = (existingItem[key] || "") + value;
        } else if (key !== "type") {
          // Don't overwrite type
          // Overwrite other fields
          existingItem[key] = value;
        }
      }
    }
  }

  return result;
}

export type LlmApiRequestType =
  | "chat"
  | "streamChat"
  | "complete"
  | "streamComplete"
  | "streamFim"
  | "embed"
  | "rerank"
  | "list";
