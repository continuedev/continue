import { BaseLLM } from "../index.js";
import { CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { streamSse } from "../stream.js";

class HuggingFaceTGI extends BaseLLM {
  static providerName: ModelProvider = "huggingface-tgi";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:8080/",
  };

  constructor(options: LLMOptions) {
    super(options);

    this.fetch(new URL("info", this.apiBase), {
      method: "GET",
    }).then(async (response) => {
      if (response.status !== 200) {
        console.warn(
          "Error calling Hugging Face TGI /info endpoint: ",
          await response.text(),
        );
        return;
      }
      const json = await response.json();
      this.model = json.model_id;
      this.contextLength = parseInt(json.max_input_length);
    });
  }

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
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const args = this._convertArgs(options, prompt);

    const response = await this.fetch(
      new URL("generate_stream", this.apiBase),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt, parameters: args }),
      },
    );

    for await (const value of streamSse(response)) {
      yield value.token.text;
    }
  }
}

export default HuggingFaceTGI;
