import { BaseLLM } from "..";
import { CompletionOptions, ModelProvider } from "../..";
import { streamSse } from "../stream";

class HuggingFaceInferenceAPI extends BaseLLM {
  static providerName: ModelProvider = "huggingface-inference-api";

  private _convertArgs(options: CompletionOptions) {
    return {
      max_new_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature,
      top_k: options.topK,
      top_p: options.topP,
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please add the `apiBase` field in your config.json.",
      );
    }

    const response = await this.fetch(this.apiBase, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        inputs: prompt,
        stream: true,
        parameters: this._convertArgs(options),
      }),
    });
    for await (const chunk of streamSse(response)) {
      let text = chunk?.token?.text ?? "";
      if (text.endsWith("</s>")) {
        yield text.slice(0, -5);
      } else {
        yield text;
      }
    }
  }
}

export default HuggingFaceInferenceAPI;
