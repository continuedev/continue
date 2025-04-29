import { CompletionOptions, LLMOptions } from "../../index.js";
import { streamSse } from "../stream.js";

import OpenAI from "./OpenAI.js";

/**
 * Inception Labs provider
 *
 * Integrates with Inception Labs' OpenAI-compatible API endpoints.
 * Provides access to Mercury models for autocomplete and other tasks.
 *
 * Different models use different API endpoints:
 * - mercury-editor-mini-experimental: zaragoza.api.inceptionlabs.ai
 * - mercury-editor-small-experimental: copenhagen.api.inceptionlabs.ai
 *
 * More information at: https://docs.inceptionlabs.ai/
 */
class Inception extends OpenAI {
  static providerName = "inception";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.inceptionlabs.ai/v1/",
    model: "mercury-editor-small-experimental",
    completionOptions: {
      temperature: 0.0,
      presencePenalty: 1.5,
      stop: ["\n\n", "\n \n", "<|endoftext|>"],
      model: "mercury-editor-small-experimental", // Added model to fix TypeScript error
    },
  };

  supportsFim(): boolean {
    return true;
  }

  async *_streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const endpoint = new URL("completions", this.apiBase);
    const resp = await this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        prompt: prefix,
        suffix: suffix.trim() === "" ? "<|endoftext|>" : suffix,
        max_tokens: options.maxTokens ?? 150, // Only want this for /fim, not chat
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
      if (!chunk.choices[0]) {
        continue;
      }
      yield chunk.choices[0].text;
    }
  }
}

export default Inception;
