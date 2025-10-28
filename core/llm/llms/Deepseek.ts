import { streamSse } from "@continuedev/fetch";
import { CompletionOptions, LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class Deepseek extends OpenAI {
  static providerName = "deepseek";
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = false;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.deepseek.com/",
    model: "deepseek-coder",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
  maxStopWords: number | undefined = 16;

  supportsFim(): boolean {
    return true;
  }

  async *_streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const endpoint = new URL("beta/completions", this.apiBase);
    const resp = await this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        prompt: prefix,
        suffix,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal,
    });
    for await (const chunk of streamSse(resp)) {
      yield chunk.choices[0].text;
    }
  }
}

export default Deepseek;
