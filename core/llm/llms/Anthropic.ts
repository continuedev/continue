// import AnthropicClient from "@anthropic-ai/sdk";
// import { CompletionCreateParamsBase } from "@anthropic-ai/sdk/resources/completions";
import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { anthropicTemplateMessages } from "../templates/chat";
import { CompletionOptions } from "../types";

class Anthropic extends LLM {
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

  // private _anthropic: AnthropicClient;

  constructor(options: LLMOptions) {
    super(options);

    // this._anthropic = new AnthropicClient({
    //   apiKey: options.apiKey,
    // });
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
    options: CompletionOptions
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
    options: CompletionOptions
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
    // Receive as SSE
    if (response.body === null) {
      return;
    }
    const reader = response.body.getReader();
    let chunk = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunk += new TextDecoder("utf-8").decode(value);
      const lines = chunk.split("\n");
      chunk = lines.pop() as string;
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const result = JSON.parse(line.slice(6));
          if (result.completion) {
            yield result.completion;
          }
        }
      }
    }
  }
}

export default Anthropic;
