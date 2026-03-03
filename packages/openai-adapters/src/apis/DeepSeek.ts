import { streamSse } from "@continuedev/fetch";
import {
  ChatCompletion,
  ChatCompletionChunk,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";
import { z } from "zod";

import { OpenAIConfigSchema } from "../types.js";
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
  isReasoningEnabled,
} from "../util/deepseek-converters.js";

export const DEEPSEEK_API_BASE = "https://api.deepseek.com/";
// Default configuration values

/**
 * OAI to DeepSeek API adapter
 *
 * - Includes Prefix-/ Chat Completions (stream/non-stream), and Fill-in-Middle (FIM)
 * - With proper type safety and validated conversion
 * - Repairs rare cases of missing content in chat stream responses
 * ! (beta-Endpoints may change in the future)
 */
export class DeepSeekApi extends OpenAIApi {
  // Default configuration values
  private readonly WARN_ON_UNSUPPORTED_FEATURES = true;

  constructor(config: z.infer<typeof OpenAIConfigSchema>) {
    const apiBase = config.apiBase ?? DEEPSEEK_API_BASE;
    const normalizedApiBase = apiBase.endsWith("/") ? apiBase : apiBase + "/";
    super({
      ...config,
      apiBase: normalizedApiBase,
    });
  }

  private async _throwDeepSeekError(resp: Response): Promise<never> {
    const errorText = await resp.text();
    throw new Error(`DeepSeek API error (${resp.status}): ${errorText}`);
  }

  // checks for signs of native tools in the request
  private hasToolsInConversation(body: ChatCompletionCreateParamsExt): boolean {
    if (body.tools && body.tools.length > 0) {
      return true;
    }
    // Check if tool_choice is specified (indicates intent to use tools)
    if (body.tool_choice) {
      return true;
    }
    // Check if any message contains tool_calls or tool_call_id
    for (const message of body.messages ?? []) {
      const msg = message as any;

      if (
        message.role === "assistant" &&
        Array.isArray(msg.tool_calls) &&
        msg.tool_calls.length > 0
      ) {
        return true;
      }

      if (message.role === "tool" && typeof msg.tool_call_id === "string") {
        return true;
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

    this._processWarnings(warnings);

    return { endpoint, deepSeekBody };
  }

  /**
   * Non‑streaming chat completion.
   *
   * Handles the same request conversion as the streaming endpoint but returns a complete
   * ChatCompletion object. Also applies the same reasoning‑content repair logic as the
   * streaming method, in case the API returns reasoning_content but no regular content.
   */
  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsExt,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
console.log(" ==== DeepSeek chatcompletionNonStream ", body );    

    const { endpoint, deepSeekBody } = this.prepareChatCompletionRequest(body);
console.log(" ==== DeepSeek chatcompletionNonStream ", deepSeekBody );    

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
      await this._throwDeepSeekError(resp);
    }

    // Parse the JSON response (may contain DeepSeek‑specific fields like reasoning_content)
    const responseData: any = await resp.json();

    // Repair logic for non‑streaming responses: if the API returned reasoning_content
    // but no regular content (and reasoning is enabled), copy reasoning_content into content.
    // This mirrors the repair done in the streaming method.
    if (
      isReasoningEnabled(body) &&
      responseData.choices &&
      Array.isArray(responseData.choices) &&
      responseData.choices.length > 0
    ) {
      const choice = responseData.choices[0];
      if (choice && choice.message) {
        const message = choice.message;
        const reasoningContent = message.reasoning_content;
        const hasContent =
          message.content &&
          typeof message.content === "string" &&
          message.content.trim() !== "";
        const hasToolCalls =
          message.tool_calls &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.length > 0;

        if (
          !hasContent &&
          !hasToolCalls &&
          reasoningContent &&
          typeof reasoningContent === "string" &&
          reasoningContent.trim() !== ""
        ) {
          // Copy reasoning_content into content to ensure the result is usable
          message.content = reasoningContent;
          // Note: we keep reasoning_content in the response as well
        }
      }
    }

    return responseData as ChatCompletion;
  }

  // streaming chat completion request with repair logic for missing content
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsExt,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const { endpoint, deepSeekBody } = this.prepareChatCompletionRequest(body);
console.log(" ==== DeepSeek chatcompletionStream ", deepSeekBody );    
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
      await this._throwDeepSeekError(resp);
    }

    /*  Rare streaming edge case workarounds:
     *  - If the stream ends with a finish_reason (not "tool_calls") and
     *    no content or tool_calls were ever sent, but reasoning_content was received,
     *    inject a final chunk containing the reasoning as content to rescue results of turn
     *  (remove when no longer needed)
     */

    let reasoningBuffer = "";
    let finishReason: string | null = null;
    let hasContent = false;
    let hasToolCalls = false;

    for await (const chunk of streamSse(resp as any)) {
      if (chunk.choices?.[0]?.delta?.reasoning_content) {
        reasoningBuffer += chunk.choices[0].delta.reasoning_content;
      }

      // check if chunk contains content or tool_calls
      hasContent =
        hasContent ||
        (!!chunk.choices?.[0]?.delta?.content &&
          typeof chunk.choices[0].delta.content === "string" &&
          chunk.choices[0].delta.content !== "");
      hasToolCalls =
        hasToolCalls ||
        (!!chunk.choices?.[0]?.delta?.tool_calls &&
          Array.isArray(chunk.choices[0].delta.tool_calls) &&
          chunk.choices[0].delta.tool_calls.length > 0);

      const chunkFinishReason = chunk.choices?.[0]?.finish_reason ?? null;
      if (chunkFinishReason) {
        finishReason = chunkFinishReason;
        // Do not forward provider finish_reason early; emit it as a final chunk below.
        const sanitized: ChatCompletionChunk = {
          ...chunk,
          choices: chunk.choices?.map((c: any) => ({
            ...c,
            finish_reason: null,
          })),
        } as ChatCompletionChunk;
        yield sanitized;
      } else {
        yield chunk;
      }
    }

    // fix missing content on last message
    if (
      !hasContent &&
      !hasToolCalls &&
      reasoningBuffer &&
      isReasoningEnabled(body)
    ) {
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
        ] as any,
      };
      yield repairChunk;
    }

    // emit finish chunk
    if (finishReason) {
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
            finish_reason: finishReason,
          },
        ] as ChatCompletionChunk.Choice[],
      };
      yield finishChunk;
    }
  }

  // Performs a streaming Fill-in-Middle (FIM) completion request (Beta API)
  async *fimStream(
    body: FimCreateParamsStreaming & { messages?: Array<any> },
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const warnings: string[] = [];
    const endpoint = new URL("completions", this.apiBase);
    const deepSeekBody = convertToFimDeepSeekRequestBody(body, warnings);

    // Log any warnings about unsupported features
    this._processWarnings(warnings);
    signal?.addEventListener("abort", () => {
      console.log(
        "Signal aborted at",
        new Date().toISOString(),
        "reason:",
        signal.reason,
      );
    });
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
      await this._throwDeepSeekError(resp);
    }
    // Process the streaming response
    for await (const chunk of streamSse(resp as any)) {
      if (chunk.choices && chunk.choices.length > 0) {
        yield chatChunk({
          content: chunk.choices[0].text || "",
          finish_reason: chunk.choices[0].finish_reason,
          model: deepSeekBody.model,
        });
        if (chunk.choices[0].finish_reason) {
          return;
        }
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
    const endpoint = new URL("models", this.apiBase);

    // Execute the API request
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!resp.ok) {
      await this._throwDeepSeekError(resp);
    }

    const data = await resp.json();
    return data.data || [];
  }

  // Generates the headers required for API requests
  protected getHeaders() {
    return {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  // Logs any warnings about unsupported features
  protected _processWarnings(warnings: string[]) {
    if (warnings.length > 0 && this.WARN_ON_UNSUPPORTED_FEATURES) {
      warnings.forEach((warning) => console.warn(warning));
    }
  }
}
