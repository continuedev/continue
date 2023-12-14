import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";

class Together extends BaseLLM {
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
    "mistral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "phind-codellama-34b": "Phind/Phind-CodeLlama-34B-v2",
  };

  private _getModelName(model: string) {
    return Together.MODEL_IDS[model] || this.model;
  }

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      prompt,
      model: this._getModelName(options.model),
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      max_tokens: options.maxTokens,
      repetition_penalty: options.frequencyPenalty,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await this.fetch(`${this.apiBase}/inference`, {
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
    let result: any = { done: false };
    let jsonChunk = "";
    while (!result.done) {
      result = await reader.read();
      jsonChunk = new TextDecoder().decode(result.value);
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
            let strippedChunk = chunk.startsWith("data: ")
              ? chunk.slice(6)
              : chunk;
            if (strippedChunk === "[DONE]") {
              continue;
            }
            let parsedChunk = JSON.parse(strippedChunk);

            if ("error" in parsedChunk) {
              throw new Error(parsedChunk.error);
            } else if ("choices" in parsedChunk) {
              yield parsedChunk.choices[0].text;
            }
          }
        }
      }
    }
  }
}

export default Together;
