import { streamSse } from "@continuedev/fetch";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/index.js";
import { z } from "zod";

import { OpenAIConfigSchema } from "../types.js";
import { customFetch } from "../util.js";

import { AnthropicApi } from "./Anthropic.js";

import type {
  Message,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources";

/** Reuse Continue's Messages request conversion with Ace's own authentication. */
export class AceDataCloudMessagesApi extends AnthropicApi {
  constructor(config: z.infer<typeof OpenAIConfigSchema>) {
    super({
      ...config,
      provider: "anthropic",
      apiKey: config.apiKey ?? "",
      apiBase: "https://api.acedata.cloud/v1/",
      cachingStrategy: "none",
    });
  }

  private async request(body: ChatCompletionCreateParams, signal: AbortSignal) {
    signal.throwIfAborted();
    const response = await customFetch(this.config.requestOptions)(
      new URL("messages", this.apiBase),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(
          this._convertToCleanAnthropicBody({
            ...body,
            // A request budget, not a claim about this model's maximum output.
            max_tokens: body.max_tokens ?? body.max_completion_tokens ?? 4096,
          }),
        ),
        signal,
      },
    );
    if (response.status === 499) {
      throw new DOMException("Request aborted", "AbortError");
    }
    if (!response.ok) {
      const data = await response.text();
      throw Object.assign(
        new Error(
          `Ace Data Cloud Messages failed (${response.status}): ${data}`,
        ),
        { status: response.status },
      );
    }
    return response;
  }

  override async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const result = (await (await this.request(body, signal)).json()) as Message;
    const tools = result.content.filter((block) => block.type === "tool_use");
    return {
      id: result.id,
      model: body.model,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      choices: [
        {
          index: 0,
          logprobs: null,
          finish_reason:
            result.stop_reason === "tool_use"
              ? "tool_calls"
              : result.stop_reason === "max_tokens"
                ? "length"
                : "stop",
          message: {
            role: "assistant",
            refusal: null,
            content: result.content
              .filter((block) => block.type === "text")
              .map((block) => block.text)
              .join(""),
            ...(tools.length && {
              tool_calls: tools.map((block) => ({
                id: block.id,
                type: "function" as const,
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              })),
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: result.usage?.input_tokens ?? 0,
        completion_tokens: result.usage?.output_tokens ?? 0,
        total_tokens:
          (result.usage?.input_tokens ?? 0) +
          (result.usage?.output_tokens ?? 0),
      },
    };
  }

  override async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
    }
    try {
      const response = await this.request(body, controller.signal);
      let id = "";
      let input = 0;
      let output = 0;
      const tools = new Map<number, number>();
      const chunk = (
        delta: ChatCompletionChunk.Choice.Delta,
        finish_reason: ChatCompletionChunk.Choice["finish_reason"] = null,
      ): ChatCompletionChunk => ({
        id,
        model: body.model,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        choices: [{ index: 0, delta, finish_reason, logprobs: null }],
      });
      for await (const rawEvent of streamSse(response)) {
        const event = rawEvent as RawMessageStreamEvent;
        signal.throwIfAborted();
        if (event.type === "message_start") {
          id = event.message.id;
          input = event.message.usage?.input_tokens ?? 0;
        } else if (
          event.type === "content_block_start" &&
          event.content_block.type === "tool_use"
        ) {
          const index = tools.size;
          tools.set(event.index, index);
          yield chunk({
            tool_calls: [
              {
                index,
                id: event.content_block.id,
                type: "function",
                function: { name: event.content_block.name, arguments: "" },
              },
            ],
          });
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield chunk({ content: event.delta.text });
          } else if (event.delta.type === "input_json_delta") {
            const index = tools.get(event.index);
            if (index === undefined) {
              throw new Error("Messages tool delta has no matching tool");
            }
            yield chunk({
              tool_calls: [
                { index, function: { arguments: event.delta.partial_json } },
              ],
            });
          }
        } else if (event.type === "message_delta") {
          output = event.usage?.output_tokens ?? output;
          const reason = event.delta.stop_reason;
          if (reason) {
            yield chunk(
              {},
              reason === "tool_use"
                ? "tool_calls"
                : reason === "max_tokens"
                  ? "length"
                  : "stop",
            );
          }
        }
      }
      yield {
        ...chunk({}),
        choices: [],
        usage: {
          prompt_tokens: input,
          completion_tokens: output,
          total_tokens: input + output,
        },
      };
    } finally {
      // Abort the HTTP reader even when the consumer stops iterating early.
      controller.abort();
      signal.removeEventListener("abort", abort);
    }
  }
}
