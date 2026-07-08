import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class FunctionNetwork extends OpenAI {
  static providerName = "function-network";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.function.network/v1/",
    model: "meta/llama-3.1-70b-instruct",
    maxEmbeddingBatchSize: 128,
  };

  private static modelConversion: { [key: string]: string } = {
    "mistral-7b": "mistral/mistral-7b-instruct-v0.1",
    "llama3-8b": "meta/llama-3-8b-instruct",
    "llama3.1-8b": "meta/llama-3.1-8b-instruct",
    "llama3.1-70b": "meta/llama-3.1-70b-instruct",
    "deepseek-7b": "thebloke/deepseek-coder-6.7b-instruct-awq",
  };

  constructor(options: LLMOptions) {
    super(options);
  }

  protected _convertModelName(model: string): string {
    return FunctionNetwork.modelConversion[model] ?? model;
  }

  public supportsFim(): boolean {
    return false;
  }

  public supportsCompletions(): boolean {
    return false;
  }

  public supportsPrefill(): boolean {
    return false;
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const resp = await this.fetch(new URL("embeddings", this.apiBase), {
      method: "POST",
      body: JSON.stringify({
        input: chunks,
        model: this.model,
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    return data.data.map((result: { embedding: number[] }) => result.embedding);
  }
}

export default FunctionNetwork;
