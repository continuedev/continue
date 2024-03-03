import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";
import { streamSse } from "../stream";

class Bedrock extends BaseLLM {
  static providerName: ModelProvider = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {};

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const response = await this.fetch(
      `${this.apiBase}/model/${options.model}/invoke-with-response-stream`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.amazon.eventstream",
          "content-type": "application/json",
          "x-amzn-bedrock-accept": "*/*",
        },
        body: JSON.stringify({
          inputText: prompt,
        }),
      },
    );

    for await (const value of streamSse(response)) {
      if (value.chunk) {
        yield value.chunk;
      }
    }
  }
}

export default Bedrock;
