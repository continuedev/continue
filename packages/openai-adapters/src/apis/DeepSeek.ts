import { streamSse } from "@continuedev/fetch";
import {
  ChatCompletion,
  ChatCompletionChunk,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";

import { chatChunk, customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";
import {
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

// Import converter functions
import {
  ChatCompletionCreateParamsExt,
  convertToChatDeepSeekRequestBody,
  convertToChatPrefixDeepSeekRequestBody,
  convertToFimDeepSeekRequestBody,
} from "../util/deepseek-converters.js";

export const DEEPSEEK_API_BASE = "https://api.deepseek.com/";
// Default configuration values

/**
 * DeepSeek API client implementation that extends the base OpenAIApi
 *
 * This class provides functionality to interact with the DeepSeek API,
 * including chat completions, standard completions, and FIM (Fill-in-Middle)
 * completions with proper type safety and validation.
 */
export class DeepSeekApi extends OpenAIApi {
  // Default configuration values
  private readonly WARN_ON_UNSUPPORTED_FEATURES = true;

  /**
   * Checks if tools are involved in the conversation
   */
  private hasToolsInConversation(body: ChatCompletionCreateParamsExt): boolean {
    // Check if tools are defined in the body
    if (body.tools && body.tools.length > 0) {
      return true;
    }

    // Check if tool_choice is specified (indicates intent to use tools)
    if (body.tool_choice) {
      return true;
    }

    // Check if any message contains tool_calls or tool_call_id
    if (body.messages) {
      for (const message of body.messages) {
        // Type assertion for tool-related properties
        const msg = message as any;

        // Check for tool_calls in assistant messages
        if (
          message.role === "assistant" &&
          msg.tool_calls &&
          msg.tool_calls.length > 0
        ) {
          return true;
        }
        // Check for tool_call_id in tool messages
        if (message.role === "tool" && msg.tool_call_id) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Determines the appropriate endpoint and request body for chat completions
   * based on the message structure
   */
  private prepareChatCompletionRequest(body: ChatCompletionCreateParamsExt): {
    endpoint: URL;
    deepSeekBody: any;
  } {
    const warnings: string[] = [];

    // Debug: Log incoming body
    console.log("=== DeepSeek Adapter - incoming body ===", body);

    const lastMessage = body.messages.at(-1);
    const hasTools = this.hasToolsInConversation(body);

    // Prefix completion requires:
    // 1. Last message must be from assistant
    // 2. No tools involved in the conversation (as prefix completion doesn't support tools)
    const isPrefixCompletion = lastMessage?.role === "assistant" && !hasTools;

    // Warn if tools are present but last message is from assistant
    if (lastMessage?.role === "assistant" && hasTools) {
      warnings.push(
        "Prefix completion does not support tools. Using regular chat completion instead.",
      );
    }

    const endpoint = new URL(
      isPrefixCompletion ? "beta/chat/completions" : "chat/completions",
      DEEPSEEK_API_BASE,
    );

    const deepSeekBody = isPrefixCompletion
      ? convertToChatPrefixDeepSeekRequestBody(body, warnings)
      : convertToChatDeepSeekRequestBody(body, warnings);

    // Debug: Log converted body
    console.log("=== DeepSeek Adapter - converted body ===", deepSeekBody);

    this._processWarnings(warnings);

    return { endpoint, deepSeekBody };
  }
  /**
   * Performs a non-streaming chat completion request
   *
   * @param body The chat completion parameters
   * @param signal AbortSignal to cancel the request
   * @returns Promise that resolves to the chat completion response
   */
  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsExt,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const { endpoint, deepSeekBody } = this.prepareChatCompletionRequest(body);
    console.log(
      "=== DeepSeek Adapter - non-streaming request ===",
      deepSeekBody,
    );
    // Execute the API request
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        ...deepSeekBody,
        stream: false,
      }),
      headers: this.getHeaders(),
      signal,
    });

    // Handle error responses
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`DeepSeek API error (${resp.status}): ${errorText}`);
    }

    // Return the parsed JSON response
    return await resp.json();
  }

  /**
   * Performs a streaming chat completion request with repair logic for missing content.
   *
   * If the stream ends with a finish_reason (not "tool_calls") and no content or tool_calls were ever sent,
   * but reasoning_content was received, this method injects a final chunk containing the reasoning as content.
   *
   * @param body The chat completion parameters
   * @param signal AbortSignal to cancel the request
   * @yields ChatCompletionChunk objects as they are received, with possible extra chunk on repair
   */
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsExt,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const { endpoint, deepSeekBody } = this.prepareChatCompletionRequest(body);
    console.log("==== chat stream start ====", endpoint, this.apiBase);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        ...deepSeekBody,
        stream: true,
      }),
      headers: this.getHeaders(),
      signal,
    });

    console.log("==== DS Api Base ====", this.apiBase);

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`DeepSeek API error (${resp.status}): ${errorText}`);
    }

    console.log(
      " ==== DeepSeek api Adapter - streaming request ====",
      deepSeekBody,
    );

    let reasoningBuffer = "";
    let hasOutput = false;
    let pendingFinishReason: string | null = null;

    for await (const chunk of streamSse(resp as any)) {
      // Reasoning sammeln
      if (chunk.choices?.[0]?.delta?.reasoning_content) {
        reasoningBuffer += chunk.choices[0].delta.reasoning_content;
      }

      // Prüfen, ob dieser Chunk echten Output enthält (Inhalt oder Tool-Calls)
      const hasContent =
        !!chunk.choices?.[0]?.delta?.content &&
        typeof chunk.choices[0].delta.content === "string" &&
        chunk.choices[0].delta.content.trim() !== "";
      const hasToolCalls =
        !!chunk.choices?.[0]?.delta?.tool_calls &&
        Array.isArray(chunk.choices[0].delta.tool_calls) &&
        chunk.choices[0].delta.tool_calls.length > 0;

      if (hasContent || hasToolCalls) {
        hasOutput = true;
      }
      // console.log("==== hasOutput ====", hasOutput, chunk);
      // Finish reason extrahieren und entfernen
      let finishReason = null;
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
        // Finish reason aus dem Chunk entfernen
        if (chunk.choices[0].finish_reason) {
          chunk.choices[0].finish_reason = null;
        }
      }
      // Chunk sofort ausgeben (jetzt ohne finish_reason)
      yield chunk;
      // Wenn wir einen finish_reason extrahiert haben, merken wir ihn für später
      if (finishReason) {
        pendingFinishReason = finishReason;
      }
    }

    // Nach der Schleife: Eventuell Repair und dann finish_reason senden
    if (pendingFinishReason) {
      // Repair, falls nötig
      if (!hasOutput && reasoningBuffer) {
        const repairChunk: ChatCompletionChunk = {
          id: "repair",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: body.model,
          choices: [
            {
              index: 0,
              delta: { content: reasoningBuffer },
              finish_reason: null,
            },
          ] as ChatCompletionChunk.Choice[],
        };
        yield repairChunk;
      }

      // Finish reason als separaten Chunk senden
      const finishChunk: ChatCompletionChunk = {
        id: "finish",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: body.model,
        choices: [
          {
            index: 0,
            delta: {
              content: "",
            },
            finish_reason: pendingFinishReason,
          },
        ] as ChatCompletionChunk.Choice[],
      };
      yield finishChunk;
    }
    console.log("==== chat stream end ====");
  }

  /**
   * Performs a streaming Fill-in-Middle (FIM) completion request (Beta API)
   *
   * @param body The FIM completion parameters
   * @param signal AbortSignal to cancel the request
   * @yields ChatCompletionChunk objects as they are received
   *
   * @beta This endpoint is currently in beta and may change in the future
   */
  async *fimStream(
    body: FimCreateParamsStreaming & { messages?: Array<any> },
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    console.warn("==== deepSeekBody fim stream ====");
    const warnings: string[] = [];
    const endpoint = new URL("completions", this.apiBase);
    const deepSeekBody = convertToFimDeepSeekRequestBody(body, warnings);
    console.warn("==== deepSeekBody fim stream ====", deepSeekBody);
    // Log any warnings about unsupported features
    this._processWarnings(warnings);

    // Execute the streaming API request
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        ...deepSeekBody,
        stream: true,
      }),
      headers: this.getHeaders(),
      signal,
    });

    // Handle error responses
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`DeepSeek API error (${resp.status}): ${errorText}`);
    }
    // Process the streaming response
    for await (const chunk of streamSse(resp as any)) {
      console.log("==== deepSeekBody fim stream chunk ====", chunk);
      if (chunk.choices?.[0]?.text !== undefined) {
        yield chatChunk({
          content: chunk.choices[0].text,
          finish_reason: chunk.choices[0].finish_reason,
          model: body.model,
        });
      }
    }
  }

  /**
   * Creates embeddings for the input text
   *
   * @throws {Error} Always throws an error as DeepSeek does not support embeddings
   */
  async embed(_body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    throw new Error("DeepSeek does not support embeddings API");
  }

  /**
   * Reranks a list of documents based on their relevance to a query
   *
   * @throws {Error} Always throws an error as DeepSeek does not support reranking
   */
  async rerank(_body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("DeepSeek does not support reranking API");
  }

  /**
   * Lists all available models from the DeepSeek API
   *
   * @returns Promise that resolves to an array of available models
   */
  async list(): Promise<Model[]> {
    const endpoint = new URL("models", DEEPSEEK_API_BASE);

    // Execute the API request
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "GET",
      headers: this.getHeaders(),
    });

    // Handle error responses
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`DeepSeek API error (${resp.status}): ${errorText}`);
    }

    // Return the list of models or an empty array if no data is available
    const data = await resp.json();
    return data.data || [];
  }

  /**
   * Generates the headers required for API requests
   *
   * @returns Object containing the request headers
   */
  protected getHeaders() {
    return {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  protected _processWarnings(warnings: string[]) {
    if (warnings.length > 0 && this.WARN_ON_UNSUPPORTED_FEATURES) {
      warnings.forEach((warning) => console.warn(warning));
    }
  }
}
