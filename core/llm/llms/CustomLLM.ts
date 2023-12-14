import { BaseLLM } from "..";
import { ChatMessage, CompletionOptions, CustomLLM } from "../..";

class CustomLLMClass extends BaseLLM {
  private customStreamCompletion?: (
    prompt: string,
    options: CompletionOptions
  ) => AsyncGenerator<string>;

  private customStreamChat?: (
    messages: ChatMessage[],
    options: CompletionOptions
  ) => AsyncGenerator<string>;

  constructor(custom: CustomLLM) {
    super(custom.options || { model: "custom" });
    this.customStreamCompletion = custom.streamCompletion;
    this.customStreamChat = custom.streamChat;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    if (this.customStreamChat) {
      for await (const content of this.customStreamChat(messages, options)) {
        yield { role: "assistant", content };
      }
    } else {
      for await (const update of super._streamChat(messages, options)) {
        yield update;
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    if (this.customStreamCompletion) {
      for await (const content of this.customStreamCompletion(
        prompt,
        options
      )) {
        yield content;
      }
    } else if (this.customStreamChat) {
      for await (const content of this.customStreamChat(
        [{ role: "user", content: prompt }],
        options
      )) {
        yield content;
      }
    } else {
      throw new Error(
        "Either streamCompletion or streamChat must be defined in a custom LLM in config.ts"
      );
    }
  }
}

export default CustomLLMClass;
