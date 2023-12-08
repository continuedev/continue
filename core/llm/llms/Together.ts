import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { ChatMessage, CompletionOptions } from "../types";

class Together extends LLM {
  static providerName: ModelProvider = "together";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.together.xyz",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "codellama-7b": "togethercomputer/CodeLlama-7b-Instruct",
    "codellama-13b": "togethercomputer/CodeLlama-13b-Instruct",
    "codellama-34b": "togethercomputer/CodeLlama-34b-Instruct",
    "llama2-7b": "togethercomputer/llama-2-7b-chat",
    "llama2-13b": "togethercomputer/llama-2-13b-chat",
    "llama2-70b": "togethercomputer/llama-2-70b-chat",
    "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.1",
    "phind-codellama-34b": "Phind/Phind-CodeLlama-34B-v2",
  };

  private _getModelName(model: string) {
    return Together.MODEL_IDS[model] || this.model;
  }

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      ...options,
      prompt,
      model: this._getModelName(options.model),
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.apiBase}/inference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...this._convertArgs(options, prompt),
        stream_tokens: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) {
      return "";
    }
    let result = await reader.read();
    let jsonChunk = new TextDecoder().decode(result.value);

    while (!result.done) {
      if (result.value) {
        if (
          jsonChunk.startsWith(": ping - ") ||
          jsonChunk.startsWith("data: [DONE]")
        ) {
          result = await reader.read();
          jsonChunk = new TextDecoder().decode(result.value);
          continue;
        }

        const chunks = jsonChunk.split("\n");
        for (const chunk of chunks) {
          if (chunk.trim() !== "") {
            let parsedChunk;
            if (chunk.startsWith("data: ")) {
              parsedChunk = JSON.parse(chunk.slice(6));
            } else {
              parsedChunk = JSON.parse(chunk);
            }

            if ("error" in parsedChunk) {
              throw new Error(parsedChunk.error);
            } else if ("choices" in parsedChunk) {
              yield parsedChunk.choices[0].text;
            }
          }
        }
      }

      result = await reader.read();
      jsonChunk = new TextDecoder().decode(result.value);
    }
  }
}

export default Together;
