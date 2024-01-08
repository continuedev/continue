import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";
import { streamResponse } from "../stream";

class Ollama extends BaseLLM {
  static providerName: ModelProvider = "ollama";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:11434",
    model: "codellama-7b",
  };

  private _getModel() {
    return (
      {
        "mistral-7b": "mistral:7b",
        "mixtral-8x7b": "mixtral:8x7b",
        "llama2-7b": "llama2:7b",
        "llama2-13b": "llama2:13b",
        "codellama-7b": "codellama:7b",
        "codellama-13b": "codellama:13b",
        "codellama-34b": "codellama:34b",
        "phi-2": "phi:2.7b",
        "phind-codellama-34b": "phind-codellama:34b-v2",
        "wizardcoder-7b": "wizardcoder:7b-python",
        "wizardcoder-13b": "wizardcoder:13b-python",
        "wizardcoder-34b": "wizardcoder:34b-python",
        "zephyr-7b": "zephyr:7b",
        "codeup-13b": "codeup:13b",
        "deepseek-1b": "deepseek-coder:1.3b",
        "deepseek-7b": "deepseek-coder:6.7b",
        "deepseek-33b": "deepseek-coder:33b",
      }[this.model] || this.model
    );
  }

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      prompt,
      model: this._getModel(),
      raw: true,
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        num_predict: options.maxTokens,
        stop: options.stop,
        num_ctx: this.contextLength,
      },
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await this.fetch(`${this.apiBase}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this._convertArgs(options, prompt)),
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk);
            if ("response" in j) {
              yield j["response"];
            } else if ("error" in j) {
              throw new Error(j["error"]);
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
      // Assign the last chunk to the buffer
      buffer = chunks[chunks.length - 1];
    }
  }
}

export default Ollama;
