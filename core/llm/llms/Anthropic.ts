import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

class Anthropic extends BaseLLM {
  static providerName: ModelProvider = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-5-sonnet-latest",
    contextLength: 200_000,
    completionOptions: {
      model: "claude-3-5-sonnet-latest",
      maxTokens: 4096,
    },
    apiBase: "https://api.anthropic.com/v1/",
  };

  public convertArgs(options: CompletionOptions) {
    // should be public for use within VertexAI
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

  public convertMessages(msgs: ChatMessage[]): any[] {
    // should be public for use within VertexAI
    const filteredmessages = msgs.filter((m) => m.role !== "system");
    const lastTwoUserMsgIndices = filteredmessages
      .map((msg, index) => (msg.role === "user" ? index : -1))
      .filter((index) => index !== -1)
      .slice(-2);

    const messages = filteredmessages.map((message, filteredMsgIdx) => {
      // Add cache_control parameter to the last two user messages
      // The second-to-last because it retrieves potentially already cached contents,
      // The last one because we want it cached for later retrieval.
      // See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
      const addCaching =
        this.cacheBehavior?.cacheConversation &&
        lastTwoUserMsgIndices.includes(filteredMsgIdx);

      if (typeof message.content === "string") {
        var chatMessage = {
          ...message,
          content: [
            {
              type: "text",
              text: message.content,
              ...(addCaching ? { cache_control: { type: "ephemeral" } } : {}),
            },
          ],
        };
        return chatMessage;
      }

      return {
        ...message,
        content: message.content.map((part, contentIdx) => {
          if (part.type === "text") {
            const newpart = {
              ...part,
              // If multiple text parts, only add cache_control to the last one
              ...(addCaching && contentIdx == message.content.length - 1
                ? { cache_control: { type: "ephemeral" } }
                : {}),
            };
            return newpart;
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
    const shouldCacheSystemMessage =
      !!this.systemMessage && this.cacheBehavior?.cacheSystemMessage;
    const systemMessage: string = stripImages(
      messages.filter((m) => m.role === "system")[0]?.content,
    );

    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
        ...(shouldCacheSystemMessage || this.cacheBehavior?.cacheConversation
          ? { "anthropic-beta": "prompt-caching-2024-07-31" }
          : {}),
      },
      body: JSON.stringify({
        ...this.convertArgs(options),
        messages: this.convertMessages(messages),
        system: shouldCacheSystemMessage
          ? [
              {
                type: "text",
                text: this.systemMessage,
                cache_control: { type: "ephemeral" },
              },
            ]
          : systemMessage,
      }),
    });

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }

    for await (const value of streamSse(response)) {
      if (value.type == "message_start") {console.log(value);}
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }
  }
}

export default Anthropic;
