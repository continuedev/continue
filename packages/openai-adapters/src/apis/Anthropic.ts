import { streamSse } from "@continuedev/fetch";
import fetch from "node-fetch";
import { OpenAI } from "openai/index.mjs";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from "openai/resources/index.mjs";
import { ChatCompletionCreateParams } from "openai/src/resources/index.js";
import { LlmApiConfig } from "../index.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class AnthropicApi implements BaseLlmApi {
  apiBase: string = "https://api.anthropic.com/v1/";

  constructor(protected config: LlmApiConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
  }

  private _convertBody(oaiBody: ChatCompletionCreateParams) {
    let stop = undefined;
    if (oaiBody.stop && Array.isArray(oaiBody.stop)) {
      stop = oaiBody.stop.filter((x) => x.trim() !== "");
    } else if (typeof oaiBody.stop === "string" && oaiBody.stop.trim() !== "") {
      stop = [oaiBody.stop];
    }
    const anthropicBody = {
      messages: this._convertMessages(
        oaiBody.messages.filter((msg) => msg.role !== "system"),
      ),
      system: oaiBody.messages.find((msg) => msg.role === "system")?.content,
      top_p: oaiBody.top_p,
      temperature: oaiBody.temperature,
      max_tokens: oaiBody.max_tokens ?? 4096, // max_tokens is required
      model: oaiBody.model,
      stop_sequences: stop,
      stream: oaiBody.stream,
    };

    return anthropicBody;
  }

  private _convertMessages(
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): any[] {
    const messages = msgs.map((message) => {
      if (!Array.isArray(message.content)) {
        return message;
      }
      return {
        ...message,
        content: message.content
          .map((part) => {
            if (part.type === "text") {
              if ((part.text?.trim() ?? "") === "") {
                return null;
              }
              return part;
            }
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                // @ts-ignore
                data: part.image_url.url.split(",")[1],
              },
            };
          })
          .filter((x) => x !== null),
      };
    });
    return messages;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    const response = await fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify(this._convertBody(body)),
    });

    const completion = (await response.json()) as any;
    return {
      id: completion.id,
      object: "chat.completion",
      model: body.model,
      created: Date.now(),
      usage: {
        total_tokens:
          completion.usage.input_tokens + completion.usage.output_tokens,
        completion_tokens: completion.usage.output_tokens,
        prompt_tokens: completion.usage.input_tokens,
      },
      choices: [
        {
          logprobs: null,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: completion.content[0].text,
            refusal: null,
          },
          index: 0,
        },
      ],
    };
  }
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    body.messages;
    const response = await fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify(this._convertBody(body)),
    });

    for await (const value of streamSse(response as any)) {
      if (value.delta?.text) {
        yield {
          id: value.id,
          object: "chat.completion.chunk",
          model: body.model,
          created: Date.now(),
          choices: [
            {
              index: 0,
              logprobs: undefined,
              finish_reason: null,
              delta: {
                role: "assistant",
                content: value.delta.text,
              },
            },
          ],
          usage: undefined,
        };
      }
    }
  }
  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion> {
    throw new Error("Method not implemented.");
  }
  async *completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion, any, unknown> {
    throw new Error("Method not implemented.");
  }
  async *fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    throw new Error("Method not implemented.");
  }

  async embed(
    body: OpenAI.Embeddings.EmbeddingCreateParams,
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    throw new Error("Method not implemented.");
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("Method not implemented.");
  }
}
