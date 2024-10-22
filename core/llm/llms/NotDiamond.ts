import { CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";
import { NotDiamond as NotDiamondClient } from "notdiamond-continue";

interface NotDiamondOptions extends LLMOptions {
  tradeoff?: "cost" | "latency";
  notDiamondProviders?: {
    openai?: {
      apiKey: string;
      models: string[];
    };
    anthropic?: {
      apiKey: string;
      models: string[];
    };
    google?: {
      apiKey: string;
      models: string[];
    };
    mistral?: {
      apiKey: string;
      models: string[];
    };
    perplexity?: {
      apiKey: string;
      models: string[];
    }
  };
}

class NotDiamond extends BaseLLM {
  private options: NotDiamondOptions;

  static providerName: ModelProvider = "notdiamond";
  constructor(options: NotDiamondOptions) {
    super(options);
    this.options = options;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const notdiamond = new NotDiamondClient({
      apiKey: this.apiKey,
      llmKeys: {
        openai: this.options.notDiamondProviders?.openai?.apiKey,
        anthropic: this.options.notDiamondProviders?.anthropic?.apiKey,
        google: this.options.notDiamondProviders?.google?.apiKey,
        mistral: this.options.notDiamondProviders?.mistral?.apiKey,
        perplexity: this.options.notDiamondProviders?.perplexity?.apiKey,
      },
    });

    const llmProviders = Object.keys(this.options.notDiamondProviders ?? {}).flatMap((provider) => {
      const models = this.options.notDiamondProviders?.[provider as keyof typeof this.options.notDiamondProviders]?.models;

      if (!models) {
        return [];
      }
      return models.map((model) => {
        return {
          provider: provider,
          model: model,
        };
      });
    });

    const result = await notdiamond.stream({
      messages: [{ content: prompt, role: "user" }],
      llmProviders: llmProviders as any,
      ...(this.options.tradeoff ? { tradeoff: this.options.tradeoff } : {}),
    });

    let responseContent = '';
    for await (const value of result?.stream ?? []) {
      if (value) {
        responseContent += value;
        yield value;
      }
    }

    if (result?.provider.model) {
      yield `\n\n*Recommended Model*: ${result.provider.provider}/${result.provider.model}`;
    }
  }
}

export default NotDiamond;
