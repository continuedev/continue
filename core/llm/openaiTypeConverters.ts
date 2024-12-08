import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  CompletionCreateParams,
} from "openai/resources/index";

import { FimCreateParamsStreaming } from "@continuedev/openai-adapters/dist/apis/base";
import { ChatMessage, CompletionOptions } from "..";

export function toChatMessage(
  message: ChatMessage,
): ChatCompletionMessageParam {
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  if (typeof message.content === "string") {
    return {
      role: message.role,
      content: message.content,
    };
  } else if (!message.content.some((item) => item.type !== "text")) {
    // If no multi-media is in the message, just send as text
    // for compatibility with OpenAI-"compatible" servers
    // that don't support multi-media format
    return {
      ...message,
      content: message.content.map((item) => item.text).join(""),
    };
  }

  const parts = message.content.map((part) => {
    const msg: any = {
      type: part.type,
      text: part.text,
    };
    if (part.type === "imageUrl") {
      msg.image_url = { ...part.imageUrl, detail: "auto" };
      msg.type = "image_url";
    }
    return msg;
  });

  return {
    ...message,
    content: parts,
  };
}

export function toChatBody(
  messages: ChatMessage[],
  options: CompletionOptions,
): ChatCompletionCreateParams {
  const tools = options.tools?.map((tool) => ({
    type: tool.type,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
      strict: tool.function.strict,
    },
  }));

  return {
    messages: messages.map(toChatMessage),
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    top_p: options.topP,
    frequency_penalty: options.frequencyPenalty,
    presence_penalty: options.presencePenalty,
    stream: options.stream ?? true,
    stop: options.stop,
    tools,
    prediction: options.prediction,
  };
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

export function fromChatResponse(response: ChatCompletion): ChatMessage {
  const message = response.choices[0].message;
  const toolCall = message.tool_calls?.[0];
  if (toolCall) {
    return {
      role: "assistant",
      content: "",
      toolCalls: message.tool_calls,
    };
  }

  return {
    role: "assistant",
    content: message.content ?? "",
  };
}

export function fromChatCompletionChunk(
  chunk: ChatCompletionChunk,
): ChatMessage | undefined {
  const delta = chunk.choices?.[0]?.delta;

  if (delta?.content) {
    return {
      role: "assistant",
      content: delta.content,
    };
  } else if (delta?.tool_calls) {
    return {
      role: "assistant",
      content: "",
      toolCalls: delta?.tool_calls.map((tool_call: any) => ({
        id: tool_call.id,
        type: tool_call.type,
        function: {
          name: tool_call.function.name,
          arguments: tool_call.function.arguments,
        },
      })),
    };
  }

  return undefined;
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
