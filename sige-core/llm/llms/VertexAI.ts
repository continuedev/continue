import { AuthClient, GoogleAuth, JWT, auth } from "google-auth-library";

import { streamResponse, streamSse } from "@continuedev/fetch";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

import { LlmApiRequestType } from "../openaiTypeConverters.js";
import Anthropic from "./Anthropic.js";
import Gemini from "./Gemini.js";

class VertexAI extends BaseLLM {
  static providerName = "vertexai";
  declare apiBase: string;
  declare vertexProvider: "mistral" | "anthropic" | "gemini" | "unknown";
  declare anthropicInstance: Anthropic;
  declare geminiInstance: Gemini;
  static AUTH_SCOPES = "https://www.googleapis.com/auth/cloud-platform";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    maxEmbeddingBatchSize: 250,
    region: "us-central1",
  };

  private clientPromise: Promise<AuthClient | void>;

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "chat",
    "embed",
    "list",
    "rerank",
    "streamChat",
    "streamFim",
  ];

  /*
      Vertex Supports 3 different URL formats 
      1. Standard VertexAI: e.g. https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent
      2. Tuned model:       e.g. https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/{endpoint}:streamGenerateContent
      3. Express mode:      e.g. https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:streamGenerateContent?key={API_KEY} // see https://cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview

      Authentication can be done using the following
      2. Access token obtained using Google Auth client, passed to endpoint that includes full model path with project id and region
      1. API Key (express mode), region and projectId will be ignored

      In all cases we have defined apiBase to be up to everything including the location.
      Standard api base: https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/
      Express api base: https://aiplatform.googleapis.com/v1/
      TODO endpoints is not currently supported (api base is same as standard but we don't have a way to add endpoint name yet

      Note that VertexAI uses the term "service endpoint" and "model", like:
      {service-endpoint}/v1/{model}:streamGenerateContent
      So "model" includes the project, location, publisher, etc

      Express mode has limited support 
      and CRITICALLY is only available to NEW users who had NOT used cloud services before.
      However it is pretty common as gemini becomes more popular.
      Only Gemini models are supported for now
      https://cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview#models
  */
  constructor(_options: LLMOptions) {
    if (_options.region !== "us-central1") {
      // Any region outside of us-central1 has a max batch size of 5.
      _options.maxEmbeddingBatchSize = Math.min(
        _options.maxEmbeddingBatchSize ?? 5,
        5,
      );
    }
    super(_options);

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

    // Set client authentication promise
    const { apiKey, region, projectId, env } = _options;
    const keyFile = env?.keyFile;
    const keyJson = env?.keyJson;

    // Acceptable authentication methods:
    // apiKey only
    // region and projectId AND (keyFile OR keyJson OR nothing)

    if (apiKey) {
      // Consider warning here instead of throwing error
      if (region || projectId || keyFile || keyJson) {
        throw new Error(
          "Vertex in express mode (api key only) cannot be configured with region, projectId, keyFile, or keyJson",
        );
        // console.warn(
        //   "Region, projectId, and key path/file are ignored when apiKey is set. See VertexAI Express Mode docs https://cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview",
        // );
      }
      if (this.vertexProvider !== "gemini") {
        throw new Error(
          "VertexAI: only gemini models are supported in express (apiKey) mode. See https://cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview#models",
        );
      }
    } else {
      if (!region && !projectId) {
        throw new Error(
          "region and projectId are required for VertexAI (when not using express/apiKey mode)",
        );
      }
      if (keyFile && keyJson) {
        throw new Error(
          "VertexAI credentials can be configured with either keyFile or keyJson but not both",
        );
      }
    }

    if (keyJson) {
      // Loading keys from manually set JSON
      if (typeof keyJson !== "string") {
        throw new Error("VertexAI: keyJson must be a JSON string");
      }
      try {
        const parsed = JSON.parse(keyJson);
        if (!parsed?.private_key) {
          throw new Error("VertexAI: keyJson must contain a valid private key");
        }
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        const jsonClient = auth.fromJSON(parsed);
        if (jsonClient instanceof JWT) {
          jsonClient.scopes = [VertexAI.AUTH_SCOPES];
        } else {
          throw new Error("VertexAI: keyJson must be a valid JWT");
        }
        this.clientPromise = Promise.resolve(jsonClient);
      } catch (e) {
        throw new Error("VertexAI: Failed to parse keyJson");
      }
    } else if (keyFile) {
      // Loading keys from manually set file path
      if (typeof keyFile !== "string") {
        throw new Error("VertexAI: keyFile must be a string");
      }
      this.clientPromise = new GoogleAuth({
        scopes: VertexAI.AUTH_SCOPES,
        keyFile,
      })
        .getClient()
        .catch((e) => {
          console.warn(
            `Failed to load credentials for Vertex AI: ${e.message}`,
          );
        });
    } else {
      // Loading keys from local credentials or environment variable
      this.clientPromise = new GoogleAuth({
        scopes: VertexAI.AUTH_SCOPES,
      })
        .getClient()
        .catch((e) => {
          console.warn(
            `Failed to load credentials for Vertex AI: ${e.message}`,
          );
        });
    }

    // Set api base
    if (!this.apiBase) {
      if (apiKey) {
        // Express mode
        this.apiBase = `https://aiplatform.googleapis.com/v1/`;
      } else {
        this.apiBase = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/`;
      }
    }

    // Uses instances of other LLMs since underlying functionality is the same
    this.anthropicInstance = new Anthropic(_options);
    this.geminiInstance = new Gemini(_options);
  }

  async fetch(url: URL, init?: RequestInit) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    } else {
      const client = await this.clientPromise;
      const result = await client?.getAccessToken();
      if (!result?.token) {
        throw new Error(
          "Could not get an access token. Set up your Google Application Default Credentials.",
        );
      }
      headers.Authorization = `Bearer ${result.token}`;
    }

    return await super.fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        ...headers,
      },
    });
  }

  // Anthropic functions
  private _anthropicConvertArgs(options: CompletionOptions) {
    const convertedArgs = this.anthropicInstance.convertArgs(options);

    // Remove the `model` property and add `anthropic_version`
    // For claude 4 models
    // anthropic_version is a required parameter and must be set to "vertex-2024-10-22".

    // const
    const { model, ...finalOptions } = convertedArgs;
    return {
      ...finalOptions,
      anthropic_version: "vertex-2023-10-16",
    };
  }

  protected async *StreamChatAnthropic(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal,
  ): AsyncGenerator<ChatMessage> {
    const systemMessage = stripImages(
      messages.filter((m) => m.role === "system")[0]?.content ?? "",
    );
    const shouldCacheSystemMessage = !!(
      this.cacheBehavior?.cacheSystemMessage && systemMessage
    );
    const shouldCachePrompt = !!(
      this.cacheBehavior?.cacheConversation ??
      this.completionOptions.promptCaching
    );

    //  <code>/v1/publishers/anthropic/models/claude-3-5-sonnet-20240620:streamRawPredict

    const apiURL = new URL(
      `publishers/anthropic/models/${options.model}:streamRawPredict`,
      this.apiBase,
    );

    const response = await this.fetch(apiURL, {
      method: "POST",
      headers: {
        ...(shouldCacheSystemMessage || shouldCachePrompt
          ? { "anthropic-beta": "prompt-caching-2024-07-31" }
          : {}),
      },
      body: JSON.stringify({
        ...this._anthropicConvertArgs(options),
        messages: this.anthropicInstance.convertMessages(
          messages,
          shouldCachePrompt,
        ),
        system: shouldCacheSystemMessage
          ? [
              {
                type: "text",
                text: systemMessage,
                cache_control: { type: "ephemeral" },
              },
            ]
          : systemMessage,
      }),
      signal,
    });

    yield* this.anthropicInstance.handleResponse(response, options.stream);
  }

  // Gemini
  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal,
  ): AsyncGenerator<ChatMessage> {
    const apiURL = new URL(
      `publishers/google/models/${options.model}:streamGenerateContent`,
      this.apiBase,
    );

    // For some reason gemini through vertex does not support ids in functionResponses yet
    const body = this.geminiInstance.prepareBody(
      messages,
      options,
      false,
      false,
    );
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    yield* this.geminiInstance.processGeminiResponse(streamResponse(response));
  }

  private async *streamChatBison(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal,
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
      signal,
    });
    if (response.status === 499) {
      return; // Aborted by user
    }
    const data = await response.json();
    yield { role: "assistant", content: data.predictions[0].content };
  }

  //Mistral

  protected async *StreamChatMistral(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal,
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
      signal,
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
      if (chunk.choices?.[0].delta) {
        yield chunk.choices[0].delta.content;
      }
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
    if (resp.status === 499) {
      return; // Aborted by user
    }
    // Streaming is not supported by code-gecko
    // TODO: convert to non-streaming fim method when one exist in continue.
    yield (await resp.json()).predictions[0].content;
  }

  // Manager functions

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
      yield* this.streamChatGemini(convertedMsgs, options, signal);
    } else if (this.vertexProvider === "mistral") {
      yield* this.StreamChatMistral(messages, options, signal);
    } else if (this.vertexProvider === "anthropic") {
      yield* this.StreamChatAnthropic(messages, options, signal);
    } else {
      if (options.model.includes("bison")) {
        yield* this.streamChatBison(convertedMsgs, options, signal);
      } else {
        throw new Error(`Unsupported model: ${options.model}`);
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
    return (
      this.model.includes("code-gecko") || this.model.includes("codestral")
    );
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const client = await this.clientPromise;
    const result = await client?.getAccessToken();
    if (!result?.token) {
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
          Authorization: `Bearer ${result.token}`,
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

export default VertexAI;
