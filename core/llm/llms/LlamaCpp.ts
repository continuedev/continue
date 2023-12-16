import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";
import { streamResponse } from "../stream";

class LlamaCpp extends BaseLLM {
  static providerName: ModelProvider = "llama.cpp";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://127.0.0.1:8080",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      n_predict: options.maxTokens,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const headers = {
      "Content-Type": "application/json",
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(`${this.apiBase}/completion`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        stream: true,
        ...this._convertArgs(options, prompt),
      }),
    });

    let buffer = "";
    for await (const chunk of streamResponse(resp)) {
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim() === "") continue;
        const data = JSON.parse(line.substring(6));
        if ("error" in data) {
          throw new Error(data.error);
        }
        yield data.content;
      }
    }

    const lines = buffer.split("\n");
    for (const line of lines) {
      if (line.trim() === "") continue;
      yield JSON.parse(line.substring(6))["content"];
    }
  }
}

export default LlamaCpp;
