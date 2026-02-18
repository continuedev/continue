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
      this.apiBase,
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
    console.log("=== DeepSeek Adapter - non-streaming request ===", body);

    const { endpoint, deepSeekBody } = this.prepareChatCompletionRequest(body);

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
   * Performs a streaming chat completion request
   *
   * @param body The chat completion parameters
   * @param signal AbortSignal to cancel the request
   * @yields ChatCompletionChunk objects as they are received
   */
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsExt,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const { endpoint, deepSeekBody } = this.prepareChatCompletionRequest(body);

    console.warn("=== Starting DeepSeek streaming request ===");
    console.log("Endpoint:", endpoint);
    console.log("Request body:", JSON.stringify(deepSeekBody, null, 2));

    try {
      const resp = await customFetch(this.config.requestOptions)(endpoint, {
        method: "POST",
        body: JSON.stringify({
          ...deepSeekBody,
          stream: true,
        }),
        headers: this.getHeaders(),
        signal,
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("DeepSeek API error:", {
          status: resp.status,
          statusText: resp.statusText,
          error: errorText,
        });
        throw new Error(`DeepSeek API error (${resp.status}): ${errorText}`);
      }

      console.log("Streaming response received, status:", resp.status);

      let chunkCount = 0;
      for await (const chunk of streamSse(resp as any)) {
        chunkCount++;
        console.log(`Chunk #${chunkCount}:`, JSON.stringify(chunk, null, 2));

        if (chunk.choices?.length) {
          const finishReason = chunk.choices[0]?.finish_reason;
          if (finishReason) {
            console.log("Finish reason detected:", finishReason);
          }
        }

        // Yield all chunks, including usage chunks that may have empty choices array
        yield chunk;
      }

      console.log(`Stream completed. Processed ${chunkCount} chunks.`);
    } catch (error) {
      console.error("Error in chatCompletionStream:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
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
    console.warn("=== deepSeekBody fim stream ===", body);
    const warnings: string[] = [];
    const endpoint = new URL("beta/completions", this.apiBase);
    const deepSeekBody = convertToFimDeepSeekRequestBody(body, warnings);
    console.warn("=== deepSeekBody fim stream ===", deepSeekBody);
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
