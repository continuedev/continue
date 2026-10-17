import { streamSse } from "@continuedev/fetch";
import { CompletionOptions, LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

// Bases already rooted at /beta only need `completions`. Other bases keep the
// historical `beta/completions` suffix, including when the slash is omitted.
function deepseekFimEndpoint(apiBase: string | undefined): URL {
  if (!apiBase) {
    return new URL("beta/completions", apiBase);
  }

  const baseUrl = new URL(apiBase);
  const pathname = baseUrl.pathname.replace(/\/+$/, "") || "/";
  if (pathname.endsWith("/beta")) {
    baseUrl.pathname = `${pathname}/`;
    return new URL("completions", baseUrl);
  }

  return new URL("beta/completions", apiBase);
}

class Deepseek extends OpenAI {
  static providerName = "deepseek";
  protected supportsReasoningField = false;
  protected supportsReasoningDetailsField = false;
  protected supportsReasoningContentField = true;
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
    const endpoint = deepseekFimEndpoint(this.apiBase);
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
