import { streamSse } from "@continuedev/fetch";
import { ChatCompletionChunk, Model } from "openai/resources/index";
import { InceptionConfig } from "../types.js";
import { chatChunk, customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";
import { FimCreateParamsStreaming } from "./base.js";

export class InceptionApi extends OpenAIApi {
  static apiBase: string = "https://api.inceptionlabs.ai/v1/";

  constructor(config: InceptionConfig) {
    super({
      ...config,
      provider: "openai",
      apiBase: config.apiBase ?? InceptionApi.apiBase,
    });
  }

  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const endpoint = new URL("completions", InceptionApi.apiBase);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt,
        suffix: body.suffix.trim() === "" ? "<|endoftext|>" : body.suffix,
        max_tokens: body.max_tokens ?? 150, // Only want this for /fim, not chat
        temperature: body.temperature,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stop: [...(body.stop ?? []), "\n\n", "\n \n"],
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal,
    });
    for await (const chunk of streamSse(resp as any)) {
      if (!chunk.choices[0]) {
        continue;
      }
      yield chatChunk({
        content: chunk.choices[0].text,
        finish_reason: null,
        model: body.model,
      });
    }
  }

  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }
}
