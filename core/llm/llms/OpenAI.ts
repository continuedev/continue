import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";
import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";

class OpenAI extends BaseLLM {
  static providerName: ModelProvider = "openai";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.openai.com",
  };

  protected _convertArgs(
    options: any,
    messages: ChatMessage[]
  ): ChatCompletionCreateParamsBase {
    const finalOptions: ChatCompletionCreateParamsBase = {
      messages,
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
    };

    return finalOptions;
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    let completion = "";
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options
    )) {
      completion += chunk.content;
    }

    return completion;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options
    )) {
      yield chunk.content;
    }
  }

  private _getChatUrl() {
    if (this.apiType === "azure") {
      return `${this.apiBase}/openai/deployments/${this.engine}/chat/completions?api-version=${this.apiVersion}`;
    } else {
      return this.apiBase + "/v1/chat/completions";
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const response = await this.fetch(this._getChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "api-key": this.apiKey || "", // For Azure
      },
      body: JSON.stringify({
        ...this._convertArgs(options, messages),
        stream: true,
      }),
    });

    // Receive as SSE
    if (response.body === null) {
      return;
    }
    let buffer = "";
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += new TextDecoder("utf-8").decode(value);
      let position;
      while ((position = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, position);
        buffer = buffer.slice(position + 1);
        if (line.startsWith("data: ") && !line.startsWith("data: [DONE]")) {
          const result = JSON.parse(line.slice(6));
          if (result.choices?.[0]?.delta?.content) {
            yield result.choices[0].delta;
          }
        }
      }
    }
    if (buffer.length > 0) {
      if (buffer.startsWith("data: ") && !buffer.startsWith("data: [DONE]")) {
        const result = JSON.parse(buffer.slice(6));
        if (result.choices?.[0]?.delta?.content) {
          yield result.choices[0].delta;
        }
      } else {
        try {
          const result = JSON.parse(buffer);
          if (result.error) {
            throw new Error(result.error);
          }
        } catch (e) {}
      }
    }
  }
}

export default OpenAI;
