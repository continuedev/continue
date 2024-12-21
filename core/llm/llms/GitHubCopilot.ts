import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

class GitHubCopilot extends BaseLLM {
  static providerName = "github-copilot";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.githubcopilot.com/v1/",
  };

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, signal, options)) {
      yield renderChatMessage(update);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const response = await this.fetch(new URL("chat/completions", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        messages,
        stream: true,
        model: this.model,
        ...options,
      }),
      signal,
    });

    for await (const value of streamSse(response)) {
      if (value.choices?.[0]?.delta?.content) {
        yield {
          role: "assistant",
          content: value.choices[0].delta.content,
        };
      }
    }
  }
}

export default GitHubCopilot;
