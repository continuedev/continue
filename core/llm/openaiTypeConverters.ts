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
import type {
  EasyInputMessage,
  Response as OpenAIResponse,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
  ResponseInputMessageContentList,
  ResponseOutputItem,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseReasoningItem,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseReasoningSummaryTextDoneEvent,
  ResponseReasoningTextDeltaEvent,
  ResponseReasoningTextDoneEvent,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses.mjs";

import {
  AssistantChatMessage,
  ChatMessage,
  CompletionOptions,
  MessageContent,
  MessagePart,
  TextMessagePart,
  ThinkingChatMessage,
  ToolCallDelta,
} from "..";
import { stripImages } from "../util/messageContent";

function appendReasoningFieldsIfSupported(
  msg: ChatCompletionAssistantMessageParam & {
    reasoning?: string;
    reasoning_content?: string;
    reasoning_details?: any[];
  },
  options: CompletionOptions,
  prevMessage?: ChatMessage,
  providerFlags?: {
    includeReasoningField?: boolean;
    includeReasoningDetailsField?: boolean;
    includeReasoningContentField?: boolean;
  },
) {
  const includeReasoning = !!providerFlags?.includeReasoningField;
  const includeReasoningDetails = !!providerFlags?.includeReasoningDetailsField;
  const includeReasoningContent = !!providerFlags?.includeReasoningContentField;
  if (!includeReasoning && !includeReasoningDetails && !includeReasoningContent)
    return;

  const hasThinkingContent = prevMessage && prevMessage.role === "thinking";

  // DeepSeek Reasoner requires reasoning_content on every assistant message,
  // even when no thinking message precedes it (e.g. resumed sessions).
  // Default to empty string to avoid 400 "Missing reasoning_content field".
  if (includeReasoningContent) {
    msg.reasoning_content = hasThinkingContent
      ? stripImages(prevMessage.content)
      : "";
  }

  if (!hasThinkingContent) return;

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
    msg.reasoning = stripImages(prevMessage.content);
  }
}

export function toChatMessage(
  message: ChatMessage,
  options: CompletionOptions,
  prevMessage?: ChatMessage,
  providerFlags?: {
    includeReasoningField?: boolean;
    includeReasoningDetailsField?: boolean;
    includeReasoningContentField?: boolean;
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
      reasoning_content?: string;
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
      content: message.content.some((item) => item.type !== "text")
        ? message.content.map((part) => {
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
          })
        : message.content
            .map((item) => (item as TextMessagePart).text)
            .join("") || " ",
    };
  }
}

export function toChatBody(
  messages: ChatMessage[],
  options: CompletionOptions,
  providerFlags?: {
    includeReasoningField?: boolean;
    includeReasoningDetailsField?: boolean;
    includeReasoningContentField?: boolean;
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

function handleTextDeltaEvent(
  e: ResponseTextDeltaEvent,
): ChatMessage | undefined {
  return e.delta ? { role: "assistant", content: e.delta } : undefined;
}

function handleFunctionCallArgsDelta(e: any): ChatMessage | undefined {
  const ev: any = e as any;
  const item = ev.item || {};
  const name = item && typeof item.name === "string" ? item.name : undefined;
  const argDelta =
    typeof ev.delta === "string"
      ? ev.delta
      : (ev.delta?.arguments ?? ev.arguments);
  if (typeof argDelta === "string" && argDelta.length > 0) {
    const call_id =
      (item?.call_id as string | undefined) ||
      (item?.id as string | undefined) ||
      "";
    const toolCalls: ToolCallDelta[] = [
      {
        id: call_id,
        type: "function",
        function: { name: name || "", arguments: argDelta },
      },
    ];
    const assistant: AssistantChatMessage = {
      role: "assistant",
      content: "",
      toolCalls,
    };
    return assistant;
  }
  return undefined;
}

function handleOutputItemAdded(
  e: ResponseOutputItemAddedEvent,
): ChatMessage | undefined {
  const { item } = e;
  if (item.type === "reasoning") {
    const details: Array<{ [k: string]: unknown }> = [];
    if (item.id) details.push({ type: "reasoning_id", id: item.id });
    if (item.encrypted_content) {
      details.push({
        type: "encrypted_content",
        encrypted_content: item.encrypted_content,
      });
    }
    if (Array.isArray(item.summary)) {
      for (const part of item.summary) {
        if (part?.type === "summary_text" && typeof part.text === "string") {
          details.push({ type: "summary_text", text: part.text });
        }
      }
    }
    return {
      role: "thinking",
      content: "",
      reasoning_details: details,
      metadata: {
        reasoningId: item.id,
        encrypted_content: item.encrypted_content ?? undefined,
      },
    } satisfies ThinkingChatMessage;
  }
  if (item.type === "message") {
    return {
      role: "assistant",
      content: "",
      metadata: { responsesOutputItemId: item.id },
    };
  }
  if (item.type === "function_call") {
    const toolCalls: ToolCallDelta[] = item.name
      ? [
          {
            id: item.call_id || item.id,
            type: "function",
            function: { name: item.name, arguments: item.arguments || "" },
          },
        ]
      : [];
    return {
      role: "assistant",
      content: "",
      toolCalls,
      metadata: { responsesOutputItemId: item.id },
    } satisfies AssistantChatMessage;
  }
  return undefined;
}

// encrypted_content is only available at output_item.done, not at .added
function handleOutputItemDone(
  e: ResponseOutputItemDoneEvent,
): ChatMessage | undefined {
  const { item } = e;
  if (item.type === "reasoning" && item.encrypted_content) {
    return {
      role: "thinking",
      content: "",
      reasoning_details: [
        ...(item.id ? [{ type: "reasoning_id", id: item.id }] : []),
        {
          type: "encrypted_content",
          encrypted_content: item.encrypted_content,
        },
      ],
      metadata: {
        reasoningId: item.id,
        encrypted_content: item.encrypted_content,
      },
    } satisfies ThinkingChatMessage;
  }
  return undefined;
}

function handleReasoningSummaryDelta(
  e: ResponseReasoningSummaryTextDeltaEvent,
): ChatMessage | undefined {
  const details: Array<{ [k: string]: unknown }> = [
    { type: "summary_text", text: e.delta },
  ];
  if ((e as any).item_id)
    details.push({ type: "reasoning_id", id: (e as any).item_id });
  const thinking: ThinkingChatMessage = {
    role: "thinking",
    content: e.delta,
    reasoning_details: details,
  };
  return thinking;
}

function handleReasoningSummaryDone(
  e: ResponseReasoningSummaryTextDoneEvent,
): ChatMessage | undefined {
  const details: Array<{ [k: string]: unknown }> = [];
  if (e.text) details.push({ type: "summary_text", text: e.text });
  if ((e as any).item_id)
    details.push({ type: "reasoning_id", id: (e as any).item_id });
  const thinking: ThinkingChatMessage = {
    role: "thinking",
    content: e.text,
    reasoning_details: details,
  };
  return thinking;
}

function handleReasoningTextDelta(
  e: ResponseReasoningTextDeltaEvent,
): ChatMessage | undefined {
  const details: Array<{ [k: string]: unknown }> = [
    { type: "reasoning_text", text: e.delta },
  ];
  if ((e as any).item_id)
    details.push({ type: "reasoning_id", id: (e as any).item_id });
  const thinking: ThinkingChatMessage = {
    role: "thinking",
    content: e.delta,
    reasoning_details: details,
  };
  return thinking;
}

function handleReasoningTextDone(
  e: ResponseReasoningTextDoneEvent,
): ChatMessage | undefined {
  const details: Array<{ [k: string]: unknown }> = [];
  if (e.text) details.push({ type: "reasoning_text", text: e.text });
  if ((e as any).item_id)
    details.push({ type: "reasoning_id", id: (e as any).item_id });
  const thinking: ThinkingChatMessage = {
    role: "thinking",
    content: e.text,
    reasoning_details: details,
  };
  return thinking;
}

function handleResponsesStreamEvent(
  e: ResponseStreamEvent,
): ChatMessage | undefined {
  const t = (e as any).type as string;
  if (t === "response.output_text.delta") {
    return handleTextDeltaEvent(e as ResponseTextDeltaEvent);
  }
  if (t === "response.output_text.done") {
    return undefined; // avoid duplicate final text
  }
  if (t === "response.function_call_arguments.delta") {
    return handleFunctionCallArgsDelta(e);
  }
  if (t === "response.function_call_arguments.done") {
    return undefined;
  }
  if (t === "response.output_item.added") {
    return handleOutputItemAdded(e as ResponseOutputItemAddedEvent);
  }
  if (t === "response.output_item.done") {
    return handleOutputItemDone(e as ResponseOutputItemDoneEvent);
  }
  if (t === "response.reasoning_summary_text.delta") {
    return handleReasoningSummaryDelta(
      e as ResponseReasoningSummaryTextDeltaEvent,
    );
  }
  if (t === "response.reasoning_summary_text.done") {
    return handleReasoningSummaryDone(
      e as ResponseReasoningSummaryTextDoneEvent,
    );
  }
  if (t === "response.reasoning_text.delta") {
    return handleReasoningTextDelta(e as ResponseReasoningTextDeltaEvent);
  }
  if (t === "response.reasoning_text.done") {
    return handleReasoningTextDone(e as ResponseReasoningTextDoneEvent);
  }
  return undefined;
}

function handleResponsesFinal(
  resp: OpenAIResponse,
): ChatMessage | ChatMessage[] | undefined {
  // Prefer structured output items when present
  if (Array.isArray(resp.output) && resp.output.length > 0) {
    const result: ChatMessage[] = [];
    for (const raw of resp.output as any[]) {
      const item = raw as any;
      if (!item || typeof item !== "object") continue;
      if (item.type === "reasoning") {
        const details: Array<{ [k: string]: unknown }> = [];
        if (typeof item.id === "string") {
          details.push({ type: "reasoning_id", id: item.id });
        }
        if (Array.isArray(item.summary)) {
          for (const s of item.summary) {
            if (s?.type === "summary_text" && typeof s.text === "string") {
              details.push({ type: "summary_text", text: s.text });
            }
          }
        }
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c?.type === "reasoning_text" && typeof c.text === "string") {
              details.push({ type: "reasoning_text", text: c.text });
            }
          }
        }
        if (
          typeof item.encrypted_content === "string" &&
          item.encrypted_content
        ) {
          details.push({
            type: "encrypted_content",
            encrypted_content: item.encrypted_content,
          });
        }
        const thinking: ThinkingChatMessage = {
          role: "thinking",
          content: "",
          reasoning_details: details,
          metadata: {
            reasoningId: item.id as string,
            encrypted_content: item.encrypted_content as string | undefined,
          },
        };
        result.push(thinking);
        continue;
      }
      if (item.type === "message") {
        let text = "";
        if (Array.isArray(item.content)) {
          text = (item.content as any[])
            .map((c) => (typeof c?.text === "string" ? c.text : ""))
            .join("");
        } else if (typeof item.content === "string") {
          text = item.content;
        }
        const assistant: AssistantChatMessage = {
          role: "assistant",
          content: text || "",
          metadata:
            typeof item.id === "string"
              ? { responsesOutputItemId: item.id }
              : undefined,
        };
        result.push(assistant);
        continue;
      }
      if (item.type === "function_call") {
        const name = item.name as string | undefined;
        const args =
          typeof item.arguments === "string"
            ? item.arguments
            : JSON.stringify(item.arguments ?? "");
        const call_id =
          (item.call_id as string | undefined) ||
          (item.id as string | undefined) ||
          "";
        const toolCalls: ToolCallDelta[] = name
          ? [
              {
                id: call_id,
                type: "function",
                function: { name, arguments: args || "" },
              },
            ]
          : [];
        const assistant: AssistantChatMessage = {
          role: "assistant",
          content: "",
          toolCalls,
          metadata:
            typeof item.id === "string"
              ? { responsesOutputItemId: item.id }
              : undefined,
        };
        result.push(assistant);
        continue;
      }
    }
    if (result.length > 0) return result;
  }

  // Fallback to output_text when no structured output is present
  if (typeof resp.output_text === "string" && resp.output_text.length > 0) {
    return { role: "assistant", content: resp.output_text };
  }

  return undefined;
}

export function fromResponsesChunk(
  event: ResponseStreamEvent | OpenAIResponse,
): ChatMessage | ChatMessage[] | undefined {
  if (typeof (event as any).type === "string") {
    return handleResponsesStreamEvent(event as ResponseStreamEvent);
  }
  return handleResponsesFinal(event as OpenAIResponse);
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

function getTextFromMessageContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is TextMessagePart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function toResponseInputContentList(
  parts: MessagePart[],
): ResponseInputMessageContentList {
  const list: ResponseInputMessageContentList = [];
  for (const part of parts) {
    if (part.type === "text") {
      list.push({ type: "input_text", text: part.text });
    } else if (part.type === "imageUrl") {
      list.push({
        type: "input_image",
        image_url: part.imageUrl.url,
        detail: "auto",
      });
    }
  }
  return list;
}

/** Emits function_call items for each tool call. Omits `id` when no fc_ ID is available. */
function emitFunctionCallsFromToolCalls(
  toolCalls: ToolCallDelta[],
  fcIds: string[],
  input: ResponseInput,
): void {
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const fcId = fcIds[i];

    const name = tc?.function?.name as string | undefined;
    const args = tc?.function?.arguments as string | undefined;
    const call_id = tc?.id as string | undefined;

    if (name && call_id) {
      const functionCallItem: ResponseFunctionToolCall = {
        type: "function_call",
        name,
        arguments: typeof args === "string" ? args : "{}",
        call_id,
        id: fcId,
      };
      input.push(functionCallItem);
    }
  }
}

/**
 * Converts a thinking message's reasoning_details into a ResponseReasoningItem.
 * Extracted to reduce cyclomatic complexity in toResponsesInput.
 */
function convertThinkingMessageToReasoningItem(
  msg: ThinkingChatMessage,
): ResponseReasoningItem | undefined {
  const details = msg.reasoning_details ?? [];
  if (!details.length) return undefined;

  let id: string | undefined;
  let summaryText = "";
  let encrypted: string | undefined;
  let reasoningText = "";

  for (const raw of details as Array<Record<string, unknown>>) {
    const d = raw as {
      type?: string;
      id?: string;
      text?: string;
      encrypted_content?: string;
    };
    if (d.type === "reasoning_id" && d.id) id = d.id;
    else if (d.type === "encrypted_content" && d.encrypted_content)
      encrypted = d.encrypted_content;
    else if (d.type === "summary_text" && typeof d.text === "string")
      summaryText += d.text;
    else if (d.type === "reasoning_text" && typeof d.text === "string")
      reasoningText += d.text;
  }

  // Fallback to metadata if reasoning_details was incomplete
  if (!id && typeof msg.metadata?.reasoningId === "string") {
    id = msg.metadata.reasoningId;
  }
  if (
    !encrypted &&
    typeof msg.metadata?.encrypted_content === "string" &&
    (msg.metadata.encrypted_content as string).length > 0
  ) {
    encrypted = msg.metadata.encrypted_content as string;
  }

  if (!id) return undefined;

  const reasoningItem: ResponseReasoningItem = {
    id,
    type: "reasoning",
    summary: [],
  } as ResponseReasoningItem;

  if (summaryText) {
    reasoningItem.summary = [{ type: "summary_text", text: summaryText }];
  }
  if (reasoningText) {
    reasoningItem.content = [{ type: "reasoning_text", text: reasoningText }];
  }
  if (encrypted) {
    reasoningItem.encrypted_content = encrypted;
  }

  return reasoningItem;
}

export function isItemType<T extends ResponseInputItem & { type: string }>(
  item: ResponseInputItem,
  type: T["type"],
): item is T {
  return "type" in item && item.type === type;
}

function isValidSuccessor(item: ResponseInputItem | undefined): boolean {
  if (!item) return false;
  if (isItemType<ResponseFunctionToolCall>(item, "function_call")) return true;
  if ("type" in item && item.type === "message") return true;
  if ("role" in item && item.role === "assistant") return true;
  return false;
}

/**
 * Fixes sequencing/ID issues that cause OpenAI Responses API 400 errors:
 * - Removes reasoning without encrypted_content; strips id from subsequent items
 * - Removes reasoning not followed by function_call or message
 * - Removes orphaned function_call_output with no matching function_call
 */
function sanitizeResponsesInput(input: ResponseInput): ResponseInput {
  const skipIndices = new Set<number>();
  const stripIdIndices = new Set<number>();

  for (let i = 0; i < input.length; i++) {
    if (!isItemType<ResponseReasoningItem>(input[i], "reasoning")) continue;
    const reasoning = input[i] as ResponseReasoningItem;

    if (!reasoning.encrypted_content) {
      // Can't pass reasoning without encrypted_content; strip id from
      // subsequent items so the API doesn't expect the missing reasoning
      skipIndices.add(i);
      for (let j = i + 1; j < input.length; j++) {
        if (
          isItemType<ResponseFunctionToolCall>(input[j], "function_call") ||
          ("type" in input[j] && input[j].type === "message")
        ) {
          stripIdIndices.add(j);
        } else {
          break;
        }
      }
      continue;
    }

    if (!isValidSuccessor(input[i + 1])) {
      skipIndices.add(i);
    }
  }

  const result: ResponseInput = [];
  for (let i = 0; i < input.length; i++) {
    if (skipIndices.has(i)) continue;
    if (stripIdIndices.has(i)) {
      const { id: _id, ...rest } = input[i] as ResponseFunctionToolCall;
      result.push(rest as ResponseInputItem);
    } else {
      result.push(input[i]);
    }
  }

  // Remove orphaned function_call_outputs
  const validCallIds = new Set<string>();
  for (const item of result) {
    if (isItemType<ResponseFunctionToolCall>(item, "function_call")) {
      validCallIds.add(item.call_id);
    }
  }
  return result.filter((item) => {
    if (
      !isItemType<ResponseInputItem.FunctionCallOutput>(
        item,
        "function_call_output",
      )
    )
      return true;
    return validCallIds.has(item.call_id);
  });
}

export function toResponsesInput(messages: ChatMessage[]): ResponseInput {
  const input: ResponseInput = [];

  const pushMessage = (
    role: "user" | "assistant" | "system" | "developer",
    content: string | ResponseInputMessageContentList,
  ) => {
    const normalizedRole: "user" | "assistant" | "system" | "developer" =
      role === "system" ? "developer" : role;
    const easyMsg: EasyInputMessage = {
      role: normalizedRole,
      content,
      type: "message",
    };
    input.push(easyMsg as ResponseInputItem);
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    switch (msg.role) {
      case "system": {
        const content = getTextFromMessageContent(msg.content);
        pushMessage("developer", content || "");
        break;
      }
      case "user": {
        if (typeof msg.content === "string") {
          pushMessage("user", msg.content);
        } else if (Array.isArray(msg.content)) {
          const parts = toResponseInputContentList(
            msg.content as MessagePart[],
          );
          pushMessage("user", parts.length ? parts : "");
        }
        break;
      }
      case "assistant": {
        const text = getTextFromMessageContent(msg.content);
        const toolCalls = msg.toolCalls as ToolCallDelta[] | undefined;

        // Separate fc_ IDs (for function_calls) from msg_ IDs (for messages)
        const allRespIds =
          (msg.metadata?.responsesOutputItemIds as string[] | undefined) || [];
        const respId = msg.metadata?.responsesOutputItemId as
          | string
          | undefined;
        const fcIds = allRespIds.filter((id) => id.startsWith("fc_"));
        if (fcIds.length === 0 && respId?.startsWith("fc_")) {
          fcIds.push(respId);
        }
        const msgId =
          allRespIds.find((id) => id.startsWith("msg_")) ||
          (respId?.startsWith("msg_") ? respId : undefined);

        if (Array.isArray(toolCalls) && toolCalls.length > 0) {
          emitFunctionCallsFromToolCalls(toolCalls, fcIds, input);

          if (text && text.trim()) {
            if (msgId) {
              const outputMessageItem: ResponseOutputMessage = {
                id: msgId,
                role: "assistant",
                type: "message",
                status: "completed",
                content: [
                  {
                    type: "output_text",
                    text,
                    annotations: [],
                  } satisfies ResponseOutputText,
                ],
              };
              input.push(outputMessageItem);
            } else {
              pushMessage("assistant", text);
            }
          }
        } else if (msgId) {
          const outputMessageItem: ResponseOutputMessage = {
            id: msgId,
            role: "assistant",
            type: "message",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: text || "",
                annotations: [],
              } satisfies ResponseOutputText,
            ],
          };
          input.push(outputMessageItem);
        } else {
          pushMessage("assistant", text || "");
        }
        break;
      }
      case "tool": {
        const call_id = msg.toolCallId;
        const output =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        const functionCallOutput: ResponseInputItem = {
          type: "function_call_output",
          call_id,
          output,
        } as ResponseInputItem;
        input.push(functionCallOutput);
        break;
      }
      case "thinking": {
        const reasoningItem = convertThinkingMessageToReasoningItem(
          msg as ThinkingChatMessage,
        );
        if (reasoningItem) {
          input.push(reasoningItem as ResponseInputItem);
        }
        break;
      }
    }
  }

  return sanitizeResponsesInput(input);
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
