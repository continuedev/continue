import { ChatMessage, CompletionOptions, CustomLLM } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

class CustomLLMClass extends BaseLLM {
  get providerName() {
    return "custom";
  }

  private customStreamCompletion?: (
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => AsyncGenerator<string>;

  private customStreamChat?: (
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => AsyncGenerator<ChatMessage | string>;

  constructor(custom: CustomLLM) {
    super(custom.options || { model: "custom" });
    this.customStreamCompletion = custom.streamCompletion;
    this.customStreamChat = custom.streamChat;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (this.customStreamChat) {
      for await (const content of this.customStreamChat(
        messages,
        signal,
        options,
        (...args) => this.fetch(...args),
      )) {
        if (typeof content === "string") {
          yield { role: "assistant", content };
        } else {
          yield content;
        }
      }
    } else {
      for await (const update of super._streamChat(messages, signal, options)) {
        yield update;
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    if (this.customStreamCompletion) {
      for await (const content of this.customStreamCompletion(
        prompt,
        signal,
        options,
        (...args) => this.fetch(...args),
      )) {
        yield content;
      }
    } else if (this.customStreamChat) {
      for await (const content of this.customStreamChat(
        [{ role: "user", content: prompt }],
        signal,
        options,
        (...args) => this.fetch(...args),
      )) {
        if (typeof content === "string") {
          yield content;
        } else {
          yield renderChatMessage(content);
        }
      }
    } else {
      throw new Error(
        "Either streamCompletion or streamChat must be defined in a custom LLM in config.ts",
      );
    }
  }
}

export default CustomLLMClass;
