import AnthropicClient from "@anthropic-ai/sdk";
import { CompletionCreateParamsBase } from "@anthropic-ai/sdk/resources/completions";
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
  };

  private _anthropic: AnthropicClient;

  constructor(options: LLMOptions) {
    super(options);

    this._anthropic = new AnthropicClient({
      apiKey: options.apiKey,
    });
  }

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions: CompletionCreateParamsBase = {
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
    const result = await this._anthropic.completions.create({
      ...this._convertArgs(options, prompt),
      stream: false,
    });

    return result.completion;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const stream = await this._anthropic.completions.create({
      ...this._convertArgs(options, prompt),
      stream: true,
    });
    for await (const result of stream as any) {
      yield result.completion;
    }
  }
}

export default Anthropic;
