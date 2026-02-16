import {
  ChatMessage,
  CompletionOptions,
  LLMFullCompletionOptions,
  LLMOptions,
  MessageOption,
  PromptLog,
  ThinkingChatMessage,
} from "../../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import { ChatCompletionCreateParams } from "openai/resources/index";
import OpenAI from "./OpenAI.js";

class DeepSeek extends OpenAI {
  protected supportsReasoningContentField = true;
  static providerName = "deepseek";

  private _supportsFim: boolean = false;

  static defaultOptions: Partial<LLMOptions> = {
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  // Uses the OpenAI adapter for all operations
  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "chat",
    "streamChat",
    "streamFim",
    "list",
  ];

  constructor(options: LLMOptions) {
    super(options);

    // Extract supportsFim from options (could be boolean or string "true")
    const supportsFimOption = (options as any).supportsFim;
    this._supportsFim =
      supportsFimOption === true || supportsFimOption === "true";
  }

  supportsFim(): boolean {
    // Check if this is the FIM Beta model by checking the model name or API base
    return (
      this._supportsFim ||
      this.model === "deepseek-fim-beta" ||
      (this.model === "deepseek-chat" && this.apiBase?.includes("/beta")) ||
      false
    );
  }

  // DeepSeek supports both Chat and Completion Endpoints
  supportsCompletions(): boolean {
    return false; // TODO: implement with converter or fim
  }

  supportsPrefill(): boolean {
    return true;
  }

  supportsList(): boolean {
    return true;
  }

  // Override streamChat to handle DeepSeek-specific thinking mode
  async *streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
    messageOptions?: MessageOption,
  ): AsyncGenerator<ChatMessage, PromptLog> {
    // Convert model name if needed
    const modifiedOptions = this._convertCompletionOptionsModelName(options);
    // Transform messages for DeepSeek API
    const transformedMessages = this.transformMessagesForDeepSeek(messages);

    // Delegate to parent implementation
    const generator = super.streamChat(
      transformedMessages,
      signal,
      modifiedOptions,
      messageOptions,
    );
    let result: PromptLog | undefined;

    try {
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          result = value as PromptLog;
          break;
        }
        yield value as ChatMessage;
      }
    } finally {
      // Ensure generator is cleaned up
      generator.return?.(undefined as any);
    }
    // Return the result from parent
    return result!;
  }

  async *streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<string, PromptLog> {
    // Convert model name if needed before passing to parent
    const modifiedOptions = this._convertCompletionOptionsModelName(options);
    // Delegate to parent implementation
    const generator = super.streamFim(prefix, suffix, signal, modifiedOptions);
    let result: PromptLog | undefined;

    try {
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          result = value as PromptLog;
          break;
        }
        yield value as string;
      }
    } finally {
      // Ensure generator is cleaned up
      generator.return?.(undefined as any);
    }
    // Return the result from parent
    return result!;
  }

  // Transform messages to be compatible with DeepSeek API
  private transformMessagesForDeepSeek(messages: ChatMessage[]): ChatMessage[] {
    if (messages.length === 0) {
      return messages;
    }

    console.warn("=== DeepSeek transformMessagesForDeepSeek START ===");
    console.warn("Input messages:", JSON.stringify(messages, null, 2));

    // Find the last user, assistant, or system message
    // BUT: Assistant with toolCalls (AT) does NOT count as "last user/assistant/system"
    let lastUserAssistantSystemIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      console.warn(
        `  Reverse search i=${i}: role="${msg.role}", hasToolCalls: ${!!(msg as any).toolCalls}`,
      );

      if (msg.role === "user" || msg.role === "system") {
        lastUserAssistantSystemIndex = i;
        console.warn(`    Found user/system at index ${i}`);
        break;
      } else if (msg.role === "assistant") {
        // Check if assistant has tool calls
        const hasToolCalls =
          !!(msg as any).toolCalls && (msg as any).toolCalls.length > 0;
        if (!hasToolCalls) {
          // Assistant WITHOUT tool calls counts as "last user/assistant/system"
          lastUserAssistantSystemIndex = i;
          console.warn(`    Found assistant WITHOUT tool calls at index ${i}`);
          break;
        } else {
          // Assistant WITH tool calls (AT) does NOT count, continue searching
          console.warn(
            `    Assistant WITH tool calls at index ${i} - skipping, continue search`,
          );
        }
      }
    }

    // If no user, assistant, or system found, return empty
    if (lastUserAssistantSystemIndex === -1) {
      console.warn("  No user/assistant/system found, returning empty array");
      return [];
    }

    console.warn(
      `  lastUserAssistantSystemIndex = ${lastUserAssistantSystemIndex}`,
    );

    const transformed: ChatMessage[] = [];

    // Process messages
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.warn(
        `\n  Processing index ${i}: role="${msg.role}", content preview: ${typeof msg.content === "string" ? msg.content.substring(0, 50) : "array"}`,
      );

      if (i < lastUserAssistantSystemIndex) {
        console.warn(
          `    i < lastUserAssistantSystemIndex (${i} < ${lastUserAssistantSystemIndex})`,
        );
        // Messages BEFORE the last user/assistant/system
        // Special handling for thinking messages: keep them if they're part of a sequence ending with an assistant
        if (msg.role === "thinking") {
          // Check if next message is an assistant
          console.warn(
            `    -> Removing thinking message before X (role="${msg.role}")`,
          );
          // Remove thinking messages before X
          continue;
        } else {
          console.warn(
            `    -> Keeping message (not thinking, role="${msg.role}")`,
          );
          transformed.push(msg);
        }
      } else if (i === lastUserAssistantSystemIndex) {
        console.warn(
          `    i === lastUserAssistantSystemIndex (${i} === ${lastUserAssistantSystemIndex})`,
        );
        // X itself
        console.warn(`    -> Adding X itself`);
        transformed.push(msg);
      } else {
        console.warn(
          `    i > lastUserAssistantSystemIndex (${i} > ${lastUserAssistantSystemIndex})`,
        );
        // Messages AFTER the last user/assistant/system

        const nextMsg = i + 1 < messages.length ? messages[i + 1] : undefined;
        if (
          msg.role === "thinking" &&
          !(nextMsg && nextMsg.role === "assistant")
        ) {
          console.warn(
            `    -> Found thinking message after X (role="${msg.role}")`,
          );
          console.warn(
            `    -> msg.role === "thinking": ${msg.role === "thinking"}`,
          );
          // Keep thinking and add empty assistant after it
          const thinkingMsg = msg as ThinkingChatMessage;
          console.warn(`    -> Adding thinking message`);
          transformed.push(thinkingMsg);
          transformed.push({
            role: "assistant",
            content: "",
          });
          console.warn(`    -> Added empty assistant after thinking`);
        } else {
          console.warn(
            `    -> Not a lone thinking message (role="${msg.role}"), adding as-is`,
          );
          transformed.push(msg);
        }
      }
    }

    console.warn("\n=== DeepSeek transformMessagesForDeepSeek END ===");
    console.warn("Output messages:", JSON.stringify(transformed, null, 2));
    return transformed;
  }

  protected _convertModelName(model: string): string {
    if (model === "deepseek-fim-beta") {
      return "deepseek-chat";
    }
    return model;
  }

  private _convertCompletionOptionsModelName(
    options: CompletionOptions | LLMFullCompletionOptions,
  ): CompletionOptions {
    return {
      ...options,
      model: this._convertModelName(options.model || this.model),
    };
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): any {
    const convertedOptions = this._convertCompletionOptionsModelName(options);
    return super._convertArgs(convertedOptions, messages);
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    // Add stream_options to include usage statistics for DeepSeek API
    if (body.stream) {
      (body as any).stream_options = { include_usage: true };
    }
    return super.modifyChatBody(body);
  }
}

export default DeepSeek;
