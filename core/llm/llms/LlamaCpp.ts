import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { CompletionOptions } from "../types";

class LlamaCpp extends LLM {
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

    const resp = await fetch(`${this.apiBase}/completion`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        stream: true,
        ...this._convertArgs(options, prompt),
      }),
    });

    const reader = resp.body.getReader();
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      result += chunk;
    }

    const lines = result.split("\n");
    for (const line of lines) {
      if (line.trim() === "") continue;
      yield JSON.parse(line.substring(6))["content"];
    }
  }
}

export default LlamaCpp;
