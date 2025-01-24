import { GoogleAuth } from "google-auth-library";

import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamResponse, streamSse } from "../stream.js";

import Anthropic from "./Anthropic.js";
import Gemini from "./Gemini.js";

class VertexAI extends BaseLLM {
  static providerName = "vertexai";
  declare apiBase: string;
  declare vertexProvider: string;
  declare anthropicInstance: Anthropic;
  declare geminiInstance: Gemini;

  static defaultOptions: Partial<LLMOptions> | undefined = {
    maxEmbeddingBatchSize: 5,
    region: "us-central1",
  };

  private clientPromise = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  }).getClient();

  private static getDefaultApiBaseFrom(options: LLMOptions) {
    const { region, projectId } = options;
    if (!region || !projectId) {
      throw new Error(
        "region and projectId must be defined if apiBase is not provided",
      );
    }
    return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/`;
  }

  constructor(_options: LLMOptions) {
    super(_options);
    this.apiBase ??= VertexAI.getDefaultApiBaseFrom(_options);
    this.vertexProvider =
      _options.model.includes("mistral") ||
      _options.model.includes("codestral") ||
      _options.model.includes("mixtral")
        ? "mistral"
        : _options.model.includes("claude")
          ? "anthropic"
          : _options.model.includes("gemini")
            ? "gemini"
            : "unknown";
    this.anthropicInstance = new Anthropic(_options);
    this.geminiInstance = new Gemini(_options);
  }

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const client = await this.clientPromise;
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error(
        "Could not get an access token. Set up your Google Application Default Credentials.",
      );
    }
    return await super.fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  }

  // Anthropic functions
  private _anthropicConvertArgs(options: CompletionOptions) {
    const convertedArgs = this.anthropicInstance.convertArgs(options);

    // Remove the `model` property and add `anthropic_version`
    const { model, ...finalOptions } = convertedArgs;
    return {
      ...finalOptions,
      anthropic_version: "vertex-2023-10-16",
    };
  }

  protected async *StreamChatAnthropic(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const shouldCacheSystemMessage =
      !!this.systemMessage && this.cacheBehavior?.cacheSystemMessage;
    const systemMessage: string = renderChatMessage(
      messages.filter((m) => m.role === "system")[0],
    );
    const apiURL = new URL(
      `publishers/anthropic/models/${options.model}:streamRawPredict`,
      this.apiBase,
    );

    const response = await this.fetch(apiURL, {
      method: "POST",
      headers: {
        ...(shouldCacheSystemMessage || this.cacheBehavior?.cacheConversation
          ? { "anthropic-beta": "prompt-caching-2024-07-31" }
          : {}),
      },
      body: JSON.stringify({
        ...this._anthropicConvertArgs(options),
        messages: this.anthropicInstance.convertMessages(messages),
        system: shouldCacheSystemMessage
          ? [
              {
                type: "text",
                text: this.systemMessage,
                cache_control: { type: "ephemeral" },
              },
            ]
          : systemMessage,
      }),
    });

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }

    for await (const value of streamSse(response)) {
      if (value.type === "message_start") {
        console.log(value);
      }
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }
  }

  //Gemini

  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiURL = new URL(
      `publishers/google/models/${options.model}:streamGenerateContent`,
      this.apiBase,
    );
    // This feels hacky to repeat code from above function but was the quickest
    // way to ensure system message re-formatting isn't done if user has specified v1
    const isV1API = this.apiBase.includes("/v1/");

    const contents = messages
      .map((msg) => {
        if (msg.role === "system" && !isV1API) {
          return null; // Don't include system message in contents
        }
        if (msg.role === "tool") {
          return null;
        }

        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts:
            typeof msg.content === "string"
              ? [{ text: msg.content }]
              : msg.content.map(this.geminiInstance.continuePartToGeminiPart),
        };
      })
      .filter((c) => c !== null);

    const body = {
      ...this.geminiInstance.convertArgs(options),
      contents,
      // if this.systemMessage is defined, reformat it for Gemini API
      ...(this.systemMessage &&
        !isV1API && {
          systemInstruction: { parts: [{ text: this.systemMessage }] },
        }),
    };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    let buffer = "";
    for await (const chunk of streamResponse(response)) {
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
          // Incrementally stream the content to make it smoother
          const content = data.candidates[0].content.parts[0].text;
          const words = content.split(/(\s+)/);
          const delaySeconds = Math.min(4.0 / (words.length + 1), 0.1);
          while (words.length > 0) {
            const wordsToYield = Math.min(3, words.length);
            yield {
              role: "assistant",
              content: words.splice(0, wordsToYield).join(""),
            };
            await delay(delaySeconds);
          }
        } else {
          // Handle the case where the expected data structure is not found
          if (data?.candidates?.[0]?.finishReason !== "STOP") {
            console.warn("Unexpected response format:", data);
          }
        }
      }
      if (foundIncomplete) {
        buffer = parts[parts.length - 1];
      } else {
        buffer = "";
      }
    }
  }

  private async *streamChatBison(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const instances = messages.map((message) => ({ prompt: message.content }));

    const apiURL = new URL(
      `publishers/google/models/${options.model}:predict`,
      this.apiBase,
    );
    const body = {
      instances,
      parameters: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        topK: options.topK,
        stopSequences: options.stop,
        presencePenalty: options.presencePenalty,
        frequencyPenalty: options.frequencyPenalty,
      },
    };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    yield { role: "assistant", content: data.predictions[0].content };
  }

  //Mistral

  protected async *StreamChatMistral(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiBase = this.apiBase!;
    const apiURL = new URL(
      `publishers/mistralai/models/${options.model}:streamRawPredict`,
      apiBase,
    );

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      (lastMessage as any).prefix = true;
    }

    const body = {
      model: options.model,
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens,
      stream: options.stream ?? true,
      stop: options.stop,
      messages,
    };

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for await (const chunk of streamSse(response)) {
      if (chunk.choices?.[0]) {
        // At the end vertexai will return a empty chunk.
        yield chunk.choices[0].delta;
      }
    }
  }

  protected async *StreamFimMistral(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const apiBase = this.apiBase!;
    const apiURL = new URL(
      `publishers/mistralai/models/${options.model}:streamRawPredict`,
      apiBase,
    );

    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      stream: options.stream ?? true,
      stop: options.stop,
      prompt: prefix,
      suffix,
    };

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });

    for await (const chunk of streamSse(response)) {
      yield chunk.choices[0].delta.content;
    }
  }

  //gecko
  protected async *streamFimGecko(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const endpoint = new URL(
      "publishers/google/models/code-gecko:predict",
      this.apiBase,
    );
    const resp = await this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        instances: [
          {
            prefix: prefix,
            suffix: suffix,
          },
        ],
        parameters: {
          temperature: options.temperature,
          maxOutputTokens: Math.min(options.maxTokens ?? 64, 64),
          stopSequences: options.stop?.splice(0, 5),
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.frequencyPenalty,
        },
      }),
      signal,
    });
    // Streaming is not supported by code-gecko
    // TODO: convert to non-streaming fim method when one exist in continue.
    yield (await resp.json()).predictions[0].content;
  }

  //Manager functions

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const isV1API = this.apiBase.includes("/v1/");

    // Conditionally apply removeSystemMessage
    const convertedMsgs = isV1API
      ? this.geminiInstance.removeSystemMessage(messages)
      : messages;
    if (this.vertexProvider === "gemini") {
      yield* this.streamChatGemini(convertedMsgs, options);
    } else if (this.vertexProvider === "mistral") {
      yield* this.StreamChatMistral(messages, options);
    } else if (this.vertexProvider === "anthropic") {
      yield* this.StreamChatAnthropic(messages, options);
    } else {
      if (options.model.includes("bison")) {
        yield* this.streamChatBison(convertedMsgs, options);
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      signal,
      options,
    )) {
      yield renderChatMessage(message);
    }
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    if (this.model === "code-gecko") {
      yield* this.streamFimGecko(prefix, suffix, signal, options);
    } else if (this.model.includes("codestral")) {
      yield* this.StreamFimMistral(prefix, suffix, signal, options);
    } else {
      throw new Error(`Unsupported model: ${this.model}`);
    }
  }

  supportsFim(): boolean {
    return ["code-gecko", "codestral-latest"].includes(this.model);
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const client = await this.clientPromise;
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error(
        "Could not get an access token. Set up your Google Application Default Credentials.",
      );
    }

    const resp = await this.fetch(
      new URL(`publishers/google/models/${this.model}:predict`, this.apiBase),
      {
        method: "POST",
        body: JSON.stringify({
          instances: chunks.map((chunk) => ({ content: chunk })),
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    return data.predictions.map(
      (prediction: any) => prediction.embeddings.values,
    );
  }
}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export default VertexAI;
