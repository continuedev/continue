import { ChatCompletionCreateParams } from "openai/resources/index";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class NCompass extends OpenAI {
  static providerName = "ncompass";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.ncompass.tech/v1/",
  };
  static embeddingsApiEndpoint = "https://api.gcp.ncompass.tech/v1/embeddings";

  private static modelConversion: { [key: string]: string } = {
    "qwen2.5-coder-7b": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "qwen2.5-coder:7b": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "qwen2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "qwen2.5-coder:32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
  };
  protected _convertModelName(model: string): string {
    return NCompass.modelConversion[model] ?? model;
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    const finalOptions = super._convertArgs(options, messages);
    finalOptions.model = this._convertModelName(options.model);
    return finalOptions;
  }

  protected _getHeaders() {
    const headers = super._getHeaders() as {
      "Content-Type": string;
      Authorization: string;
      "api-key": string;
      Accept?: string;
    };
    headers["Accept"] = "text/event-stream";
    return headers;
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const resp = await this.fetch(NCompass.embeddingsApiEndpoint, {
      method: "POST",
      body: JSON.stringify({
        input: chunks,
        model: this.model,
        ...this.extraBodyProperties(),
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

export default NCompass;
