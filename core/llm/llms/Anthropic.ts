import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";
import { streamSse } from "../stream";
import { anthropicTemplateMessages } from "../templates/chat";

class Anthropic extends BaseLLM {
  static providerName: ModelProvider = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-2",
    templateMessages: anthropicTemplateMessages,
    contextLength: 100_000,
    completionOptions: {
      model: "claude-2",
      maxTokens: 4096,
    },
    apiBase: "https://api.anthropic.com/v1",
  };

  constructor(options: LLMOptions) {
    super(options);
  }

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      prompt,
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens_to_sample: options.maxTokens,
      model: options.model,
      stop_sequences: options.stop,
    };

    return finalOptions;
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions,
  ): Promise<string> {
    const response = await this.fetch(this.apiBase + "/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
      },
      body: JSON.stringify({
        ...this._convertArgs(options, prompt),
        stream: false,
      }),
    });
    const result = await response.json();
    return result.completion;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const response = await this.fetch(this.apiBase + "/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
      },
      body: JSON.stringify({
        ...this._convertArgs(options, prompt),
        stream: true,
      }),
    });

    for await (const value of streamSse(response)) {
      if (value.completion) {
        yield value.completion;
      }
    }
  }
}

export default Anthropic;
