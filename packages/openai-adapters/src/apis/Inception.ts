import { streamSse } from "@continuedev/fetch";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  Model,
} from "openai/resources/index";
import { InceptionConfig } from "../types.js";
import { chatChunk, customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";
import { FimCreateParamsStreaming } from "./base.js";

// export type InceptionChatCompletionCreateParamsStreaming =
//   ChatCompletionCreateParamsStreaming & {
//     nextEdit?: boolean;
//   };

// export type InceptionChatCompletionCreateParamsNonStreaming =
//   ChatCompletionCreateParamsNonStreaming & {
//     nextEdit?: boolean;
//   };

export const UNIQUE_TOKEN = "<|!@#IS_NEXT_EDIT!@#|>";
export const INCEPTION_API_BASE = "https://api.inceptionlabs.ai/v1/";
export class InceptionApi extends OpenAIApi {
  constructor(config: InceptionConfig) {
    super({
      ...config,
      provider: "openai",
      apiBase: config.apiBase ?? INCEPTION_API_BASE,
    });
  }

  // Add custom edit completions method.
  async *editCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const endpoint = new URL("edit/completions", this.apiBase);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stop: body.stop,
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal,
    });

    for await (const chunk of streamSse(resp as any)) {
      if (chunk.choices?.[0]?.delta?.content) {
        yield chatChunk({
          content: chunk.choices[0].delta.content,
          finish_reason: chunk.choices[0].finish_reason || null,
          model: body.model,
        });
      }
    }
  }

  // Add custom edit completions method (non-streaming).
  async editCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const endpoint = new URL("edit/completions", this.apiBase);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stop: body.stop,
        stream: false, // Set to false for non-streaming
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal,
    });

    const data = await resp.json();
    return data as ChatCompletion;
  }

  // Override the regular chat stream method to route to edit endpoint for next edit requests.
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    if (this.isNextEdit(body.messages)) {
      body.messages = this.removeNextEditToken(body.messages);
      yield* this.editCompletionStream(body, signal);
    } else {
      yield* super.chatCompletionStream(body, signal);
    }
  }

  // Override the regular chat non stream method to route to edit endpoint for next edit requests.
  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    if (this.isNextEdit(body.messages)) {
      body.messages = this.removeNextEditToken(body.messages);
      return this.editCompletionNonStream(body, signal);
    } else {
      return super.chatCompletionNonStream(body, signal);
    }
  }

  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const endpoint = new URL("completions", this.apiBase);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt,
        suffix: body.suffix.trim() === "" ? "<|endoftext|>" : body.suffix,
        max_tokens: body.max_tokens ?? 150, // Only want this for /fim, not chat
        temperature: body.temperature,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stop: [...(body.stop ?? []), "\n\n", "\n \n"],
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal,
    });
    for await (const chunk of streamSse(resp as any)) {
      if (!chunk.choices[0]) {
        continue;
      }
      yield chatChunk({
        content: chunk.choices[0].text,
        finish_reason: null,
        model: body.model,
      });
    }
  }

  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }

  // Check if any message contains the unique next edit token.
  private isNextEdit(messages: ChatCompletionMessageParam[]): boolean {
    return messages.some(
      (message) =>
        typeof message.content === "string" &&
        message.content.endsWith(UNIQUE_TOKEN),
    );
  }

  // Remove the unique token from messages.
  private removeNextEditToken(
    messages: ChatCompletionMessageParam[],
  ): ChatCompletionMessageParam[] {
    const lastMessage = messages[messages.length - 1];

    if (
      typeof lastMessage?.content === "string" &&
      lastMessage.content.endsWith(UNIQUE_TOKEN)
    ) {
      const cleanedMessages = [...messages];
      cleanedMessages[cleanedMessages.length - 1] = {
        ...lastMessage,
        content: lastMessage.content.slice(0, -UNIQUE_TOKEN.length),
      };
      return cleanedMessages;
    }

    return messages;
  }
}
