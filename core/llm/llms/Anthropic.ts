import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";
import { ConfigHandler } from "../../config/ConfigHandler.js";

class Anthropic extends BaseLLM {
  private configHandler: ConfigHandler;
  constructor(options: LLMOptions, configHandler: ConfigHandler) {
    super(options);
    this.configHandler = configHandler;
  }
  // give Anthropic the custom sugar and hope caching overtakes batching as industry standard. LFG THE SAVINGS!
  static providerName: ModelProvider = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-5-sonnet-20240620",
    contextLength: 200_000,
    completionOptions: {
      model: "claude-3-5-sonnet-20240620",
      maxTokens: 4096,
    },
    apiBase: "https://api.anthropic.com/v1/",
  };

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 2048,
      model: options.model === "claude-2" ? "claude-2.1" : options.model,
      stop_sequences: options.stop?.filter((x) => x.trim() !== ""),
      stream: options.stream ?? true,
    };

    return finalOptions;
  }

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = msgs
      .filter((m) => m.role !== "system")
      .map((message) => {
        if (typeof message.content === "string") {
          return {
            ...message,
            content: [
              {
                type: "text",
                text: message.content,
                cache_control: { type: "ephemeral" },
              },
            ],
          };
        }
        return {
          ...message,
          content: message.content.map((part) => {
            if (part.type === "text") {
              return {
                ...part,
                cache_control: { type: "ephemeral" },
              };
            }
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: part.imageUrl?.url.split(",")[1],
              },
            };
          }),
        };
      });
    return messages;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, options)) {
      yield stripImages(update.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": this.apiKey as string,
      "anthropic-beta": ""
    };


  // Elegant caching meant to be destroyed or escalated post-beta
  // If user leads with /nocache don't, if they /cache then do, otherwise check if the new global cache default has been overwritten, if not lfg cache it
  const lastMessage = messages[messages.length - 1];
  const lastContent = typeof lastMessage.content === 'string' ? lastMessage.content : lastMessage.content.find(part => part.type === 'text')?.text ?? '';
  
  if (!lastContent.startsWith('/nocache') && (lastContent.startsWith('/cache') || !(await this.configHandler.loadConfig()).disablePromptCaching)) {
    headers["anthropic-beta"] = "prompt-caching-2024-07-31";
  }

    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        ...this._convertArgs(options),
        messages: this._convertMessages(messages),
        system: this.systemMessage ? [
          {
            type: "text",
            text: this.systemMessage,
            cache_control: { type: "ephemeral" },
          },
        ] : undefined,
      }),
    });

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }

    for await (const value of streamSse(response)) {
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }
  }
}

export default Anthropic;
