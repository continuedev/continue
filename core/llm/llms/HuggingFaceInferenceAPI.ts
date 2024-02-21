import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";
import { streamSse } from "../stream";

class HuggingFaceInferenceAPI extends BaseLLM {
  static providerName: ModelProvider = "huggingface-inference-api";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api-inference.huggingface.co",
  };

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await this.fetch(`${this.apiBase}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        inputs: prompt,
        stream: true,
      }),
    });
    for await (const chunk of streamSse(response)) {
      yield chunk?.token?.text || "";
    }
  }
}

export default HuggingFaceInferenceAPI;
