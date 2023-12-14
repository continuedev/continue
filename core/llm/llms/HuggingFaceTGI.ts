import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";

class HuggingFaceTGI extends BaseLLM {
  static providerName: ModelProvider = "huggingface-tgi";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:8080",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      max_new_tokens: options.maxTokens,
      best_of: 1,
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      presence_penalty: options.presencePenalty,
      frequency_penalty: options.frequencyPenalty,
      stop: options.stop,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const args = this._convertArgs(options, prompt);

    const response = await this.fetch(`${this.apiBase}/generate_stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt, parameters: args }),
    });

    const reader = response.body?.getReader();
    let chunk = "";

    while (true && reader) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunk += new TextDecoder().decode(value);

      const lines = chunk.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        let processedChunk = lines[i];
        if (processedChunk.startsWith("data: ")) {
          processedChunk = processedChunk.slice("data: ".length);
        } else if (processedChunk.startsWith("data:")) {
          processedChunk = processedChunk.slice("data:".length);
        }

        if (processedChunk.trim() === "") {
          continue;
        }

        try {
          const jsonChunk = JSON.parse(processedChunk);
          yield jsonChunk.token.text;
        } catch (e) {
          console.log(`Error parsing JSON: ${e}`);
          continue;
        }
      }

      chunk = lines[lines.length - 1];
    }

    if (chunk.trim() !== "") {
      try {
        const jsonChunk = JSON.parse(chunk);
        yield jsonChunk.token.text;
      } catch (e) {
        console.log(`Error parsing JSON: ${e}`);
      }
    }
  }
}

export default HuggingFaceTGI;
