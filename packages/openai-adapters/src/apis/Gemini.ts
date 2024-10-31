import { streamResponse } from "@continuedev/fetch";
import fetch from "node-fetch";
import { OpenAI } from "openai/index.mjs";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/index.mjs";
import { LlmApiConfig } from "../index.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class GeminiApi implements BaseLlmApi {
  apiBase: string = "https://generativelanguage.googleapis.com/v1beta/";

  static maxStopSequences = 5;

  constructor(protected config: LlmApiConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
  }

  private _convertMessages(
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): any[] {
    return msgs.map((m) => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content,
    }));
  }

  private _oaiPartToGeminiPart(
    part: OpenAI.Chat.Completions.ChatCompletionContentPart,
  ) {
    return part.type === "text"
      ? {
          text: part.text,
        }
      : {
          inlineData: {
            mimeType: "image/jpeg",
            data: part.image_url?.url.split(",")[1],
          },
        };
  }

  private _convertBody(oaiBody: ChatCompletionCreateParams, url: string) {
    const generationConfig: any = {};

    if (oaiBody.top_p) {
      generationConfig.topP = oaiBody.top_p;
    }
    if (oaiBody.temperature !== undefined && oaiBody.temperature !== null) {
      generationConfig.temperature = oaiBody.temperature;
    }
    if (oaiBody.max_tokens) {
      generationConfig.maxOutputTokens = oaiBody.max_tokens;
    }
    if (oaiBody.stop) {
      const stop = Array.isArray(oaiBody.stop) ? oaiBody.stop : [oaiBody.stop];
      generationConfig.stopSequences = stop.filter((x) => x.trim() !== "");
    }

    const isV1API = url.includes("/v1/");
    const contents = oaiBody.messages
      .map((msg) => {
        if (msg.role === "system" && !isV1API) {
          return null; // Don't include system message in contents
        }
        if (!msg.content) {
          return null;
        }

        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts:
            typeof msg.content === "string"
              ? [{ text: msg.content }]
              : // @ts-ignore
                msg.content.map(this._oaiPartToGeminiPart),
        };
      })
      .filter((c) => c !== null);

    const sysMsg = oaiBody.messages.find((msg) => msg.role === "system");
    const finalBody = {
      generationConfig,
      contents,
      // if this.systemMessage is defined, reformat it for Gemini API
      ...(sysMsg &&
        !isV1API && {
          systemInstruction: { parts: [{ text: sysMsg.content }] },
        }),
    };
    return finalBody;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    let completion = "";
    for await (const chunk of this.chatCompletionStream({
      ...body,
      stream: true,
    })) {
      completion += chunk.choices[0].delta.content;
    }
    return {
      id: "",
      object: "chat.completion",
      model: body.model,
      created: Date.now(),
      choices: [
        {
          index: 0,
          logprobs: null,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: completion,
            refusal: null,
          },
        },
      ],
      usage: undefined,
    };
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    const apiURL = new URL(
      `models/${body.model}:streamGenerateContent?key=${this.config.apiKey}`,
      this.apiBase,
    ).toString();
    const resp = await fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(this._convertBody(body, apiURL)),
    });

    let buffer = "";
    for await (const chunk of streamResponse(resp as any)) {
      buffer += chunk;
      if (buffer.startsWith("[")) {
        buffer = buffer.slice(1);
      }
      if (buffer.endsWith("]")) {
        buffer = buffer.slice(0, -1);
      }
      if (buffer.startsWith(",")) {
        buffer = buffer.slice(1);
      }

      const parts = buffer.split("\n,");

      let foundIncomplete = false;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let data;
        try {
          data = JSON.parse(part);
        } catch (e) {
          foundIncomplete = true;
          continue; // yo!
        }
        if (data.error) {
          throw new Error(data.error.message);
        }
        // Check for existence of each level before accessing the final 'text' property
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          yield {
            id: "",
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
                  content: data.candidates[0].content.parts[0].text,
                },
              },
            ],
            usage: undefined,
          };
        } else {
          // Handle the case where the expected data structure is not found
          console.warn("Unexpected response format:", data);
        }
      }
      if (foundIncomplete) {
        buffer = parts[parts.length - 1];
      } else {
        buffer = "";
      }
    }
  }
  completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion> {
    throw new Error("Method not implemented.");
  }
  completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion> {
    throw new Error("Method not implemented.");
  }
  fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error("Method not implemented.");
  }
  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("Method not implemented.");
  }

  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    const response = await fetch(
      new URL(`${body.model}:batchEmbedContents`, this.apiBase),
      {
        method: "POST",
        body: JSON.stringify({
          requests: inputs.map((input) => ({
            model: body.model,
            content: {
              role: "user",
              parts: [{ text: input }],
            },
          })),
        }),
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "x-goog-api-key": this.config.apiKey,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/json",
        },
      },
    );

    const data = (await response.json()) as any;
    return {
      object: "list",
      model: body.model,
      usage: {
        total_tokens: 0,
        prompt_tokens: 0,
      },
      data: data.embeddings.map((embedding: any, index: number) => ({
        object: "embedding",
        index,
        embedding: embedding.values,
      })),
    };
  }
}
