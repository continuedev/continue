import {
  ChatMessage,
  CompletionOptions,
  LLMFullCompletionOptions,
  LLMOptions,
  MessageOption,
  PromptLog,
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
    console.log(
      " ==== core DS streamChat raw ==== ",
      messages
        .map((m) => {
          let str =
            m.role +
            ": " +
            (typeof m.content === "string"
              ? m.content.slice(0, 10)
              : JSON.stringify(m.content).slice(0, 10));
          if (m.role === "assistant" && (m as any).toolCalls) {
            const toolCallIds = (m as any).toolCalls
              .map((tc: any) => tc.id)
              .join(",");
            str += ` [toolcalls: ${toolCallIds}]`;
          } else if (m.role === "tool") {
            str += ` [toolCallId: ${(m as any).toolCallId}]`;
          }
          return str;
        })
        .join("\n"),
    );

    // Convert model name if needed
    const modifiedOptions = this._convertCompletionOptionsModelName(options);
    // Transform messages for DeepSeek API
    const transformedMessages = this._pairLoneThinkingMessages(messages);
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
        console.log(
          " ==== core DS streamChat yielded ==== ",
          value as ChatMessage,
        );
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

    console.warn(" ==== core stream FIM ====,", prefix, suffix);

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
  private _pairLoneThinkingMessages(messages: ChatMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      result.push(msg);

      // if thinking msg has no assistant msg following, insert empty assistant message
      if (msg.role === "thinking") {
        const nextMsg = messages[i + 1];
        if (!nextMsg || nextMsg.role !== "assistant") {
          result.push({
            role: "assistant",
            content: "",
          });
          console.warn(
            `Inserted empty assistant message after thinking message at index ${i} to satisfy DeepSeek format.`,
          );
        }
      }
    }
    return result;
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
