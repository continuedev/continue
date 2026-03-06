import { ChatCompletionCreateParams } from "openai/resources/index";

import {
  ChatMessage,
  LLMFullCompletionOptions,
  LLMOptions,
  MessageOption,
  PromptLog,
} from "../../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";
import { osModelsEditPrompt } from "../templates/edit.js";
import OpenAI from "./OpenAI.js";

/**
 * DeepSeek LLM provider implementation.
 *
 * This provider extends the OpenAI adapter and adds DeepSeek-specific handling:
 * - Supports thinking tool chains by pairing lone thinking messages with assistant messages
 * - Converts model names (e.g., deepseek-fim-beta to deepseek-chat)
 * - Modifies stream_options to request usage statistics when streaming
 * - Provides FIM support for beta endpoint (autocomplete) and chat completion
 */
class DeepSeek extends OpenAI {
  /**
   * DeepSeek supports the `reasoning_content` field for reasoning models.
   * This enables the model to output reasoning text separate from the final answer.
   */
  protected supportsReasoningContentField = true;
  static providerName = "deepseek";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.deepseek.com/",
    promptTemplates: {
      edit: osModelsEditPrompt, // Use OpenAI‑style edit prompt (DeepSeek is OpenAI‑compatible)
    },
    useLegacyCompletionsEndpoint: false, // DeepSeek does not support the legacy /completions endpoint
    baseChatSystemMessage:
      "You are DeepSeek running in the Continue environment. Focus on writing clean, well-structured code with concise, meaningful comments.",
  };

  /**
   * Which request types should be handled by the OpenAI‑compatible adapter.
   * The adapter (DeepSeekApi) implements the actual API communication.
   */
  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "chat", // Non‑streaming chat completions
    "streamChat", // Streaming chat completions
    "streamFim", // Streaming fill‑in‑middle (beta endpoint)
    "list", // Listing available models
  ];

  constructor(options: LLMOptions) {
    // No special initialization needed; the parent OpenAI class handles everything.
    super(options);
  }

  /**
   * Stream chat completions with DeepSeek‑specific adaptations:
   * 1. Pair lone thinking messages with an assistant message (DeepSeek requirement)
   * 2. Convert model names (e.g., deepseek‑fim‑beta → deepseek‑chat)
   * 3. Delegate to the parent OpenAI streamChat, which uses the DeepSeekApi adapter.
   */
  async *streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
    messageOptions?: MessageOption,
  ): AsyncGenerator<ChatMessage, PromptLog> {
    const transformedMessages = this._pairLoneThinkingMessages(messages);
    return yield* super.streamChat(
      transformedMessages,
      signal,
      {
        ...options,
        model: this._convertModelName(options.model || this.model),
      },
      messageOptions,
    );
  }

  /**
   * Ensures DeepSeek thinking tool chain validity.
   *
   * DeepSeek expects that every thinking message is immediately followed by an assistant message.
   * This method inserts an empty assistant message after any thinking message that is not already
   * followed by one. This preserves the correct message structure for the API.
   *
   * Example:
   *   [thinking, user] → [thinking, assistant, user]
   *   [thinking, assistant] → unchanged
   *   [thinking, tool] → [thinking, assistant, tool]
   */
  private _pairLoneThinkingMessages(messages: ChatMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      result.push(msg);

      // If this is a thinking message, check the next message.
      if (msg.role === "thinking") {
        const nextMsg = messages[i + 1];
        // Insert an empty assistant message only if the next message is not already an assistant.
        if (!nextMsg || nextMsg.role !== "assistant") {
          result.push({
            role: "assistant",
            content: "",
          });
        }
      }
    }
    return result;
  }

  /**
   * Converts internal model names to the actual model names expected by the DeepSeek API.
   *
   * The artificial model name "deepseek‑fim‑beta" is used in the configuration to signal
   * that the FIM (fill‑in‑middle) beta endpoint should be used. The actual API still uses
   * "deepseek‑chat" as the model name, but the endpoint path differs (/beta/chat/completions).
   *
   * @param model The model name from the configuration
   * @returns The model name to send to the API
   */
  protected _convertModelName(model: string): string {
    if (model === "deepseek-fim-beta") {
      return "deepseek-chat";
    }
    return model;
  }

  /**
   * Stream fill‑in‑middle (FIM) completions using DeepSeek's beta endpoint.
   * The model name is converted (deepseek‑fim‑beta → deepseek‑chat) before delegation.
   */
  async *streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<string, PromptLog> {
    return yield* super.streamFim(prefix, suffix, signal, {
      ...options,
      model: this._convertModelName(options.model || this.model),
    });
  }

  /**
   * Adds stream_options to request usage statistics in streaming responses.
   * This ensures that token usage is reported at the end of the stream.
   */
  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    if (body.stream) {
      const bodyWithStreamOptions = body as ChatCompletionCreateParams & {
        stream_options?: { include_usage: boolean };
      };
      bodyWithStreamOptions.stream_options = { include_usage: true };
    }
    return super.modifyChatBody(body);
  }

  /**
   * Determines whether FIM (fill‑in‑middle) is supported.
   * FIM is supported if:
   * - The model is explicitly "deepseek‑fim‑beta" (the artificial FIM model), or
   * - The model is "deepseek‑chat" AND the API base URL contains "/beta" (beta endpoint).
   */
  supportsFim(): boolean {
    return (
      this.model === "deepseek-fim-beta" ||
      (this.model === "deepseek-chat" && !!this.apiBase?.includes("/beta"))
    );
  }

  /**
   * DeepSeek does not support the legacy /completions endpoint (text‑only completions).
   * All completions must go through the chat or FIM endpoints.
   */
  supportsCompletions(): boolean {
    return false; // FIM could be used as workaround
  }

  /**
   * DeepSeek supports prefill (prefix completion) via the beta chat completions endpoint.
   * When the last message is from the assistant, the API treats it as a prefix completion.
   */
  supportsPrefill(): boolean {
    return true;
  }

  /**
   * DeepSeek provides a /models endpoint to list available models.
   */
  supportsList(): boolean {
    return true;
  }
}

export default DeepSeek;
