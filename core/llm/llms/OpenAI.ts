import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
import { stripImages } from "../countTokens";
import { streamSse } from "../stream";

const NON_CHAT_MODELS = [
  "text-davinci-002",
  "text-davinci-003",
  "code-davinci-002",
  "text-ada-001",
  "text-babbage-001",
  "text-curie-001",
  "davinci",
  "curie",
  "babbage",
  "ada",
];

class OpenAI extends BaseLLM {
  static providerName: ModelProvider = "openai";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.openai.com",
  };

  protected _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }

    const parts = message.content.map((part) => {
      return {
        type: part.type,
        text: part.text,
        image_url: { ...part.imageUrl, detail: "low" },
      };
    });
    return {
      ...message,
      content: parts,
    };
  }

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    const finalOptions = {
      messages: messages.map(this._convertMessage),
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
  private _getCompletionUrl() {
    if (this.apiType === "azure") {
      return `${this.apiBase}/openai/deployments/${this.engine}/completions?api-version=${this.apiVersion}`;
    } else {
      let url = this.apiBase;
      if (!url) {
        throw new Error(
          "No API base URL provided. Please set the 'apiBase' option in config.json"
        );
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (!url.endsWith("/v1") && !url.includes("api.perplexity.ai")) {
        url += "/v1";
      }
      return url + "/completions";
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options
    )) {
      yield stripImages(chunk.content);
    }
  }

  protected async *_legacystreamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await this.fetch(this._getCompletionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "api-key": this.apiKey || "", // For Azure
      },
      body: JSON.stringify({
        ...{
          prompt,
          model: options.model,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          top_p: options.topP,
          frequency_penalty: options.frequencyPenalty,
          presence_penalty: options.presencePenalty,
          stop: options.stop,
        },
        stream: true,
      }),
    });

    for await (const value of streamSse(response)) {
      if (value.choices?.[0]?.text) {
        yield value.choices[0].text;
      }
    }
  }

  private _getChatUrl() {
    if (this.apiType === "azure") {
      return `${this.apiBase}/openai/deployments/${this.engine}/chat/completions?api-version=${this.apiVersion}`;
    } else {
      let url = this.apiBase;
      if (!url) {
        throw new Error(
          "No API base URL provided. Please set the 'apiBase' option in config.json"
        );
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }

      if (!url.includes("/v1") && !url.includes("api.perplexity.ai")) {
        // includes instead of endsWith becuase DeepInfra uses /v1/openai/chat/completions
        url += "/v1";
      }
      return url + "/chat/completions";
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    if (NON_CHAT_MODELS.includes(options.model)) {
      for await (const content of this._legacystreamComplete(
        stripImages(messages[messages.length - 1]?.content || ""),
        options
      )) {
        yield {
          role: "assistant",
          content,
        };
      }
      return;
    }

    let body = {
      ...this._convertArgs(options, messages),
      stream: true,
    };
    // Empty messages cause an error in LM Studio
    body.messages = body.messages.map((m) => ({
      ...m,
      content: m.content === "" ? " " : m.content,
    })) as any;
    const response = await this.fetch(this._getChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "api-key": this.apiKey || "", // For Azure
      },
      body: JSON.stringify(body),
    });

    for await (const value of streamSse(response)) {
      if (value.choices?.[0]?.delta?.content) {
        yield value.choices[0].delta;
      }
    }
  }
}

export default OpenAI;
