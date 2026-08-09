import { streamSse } from "@continuedev/fetch";
import { ChatCompletionChunk } from "openai/resources/index";
import { LlamastackConfig } from "../types.js";
import { chatChunk, customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";
import { FimCreateParamsStreaming } from "./base.js";

export const Llamastack_API_BASE = "http://localhost:8321/v1/openai/v1/";
export class LlamastackApi extends OpenAIApi {
  constructor(config: LlamastackConfig) {
    super({
      ...config,
      provider: "openai",
      apiBase: config.apiBase ?? Llamastack_API_BASE,
      apiKey: config.apiKey ?? "dummy",
    });
  }

  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const endpoint = new URL("completions", this.apiBase);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt,
        suffix: body.suffix,
        max_tokens: body.max_tokens,
        max_completion_tokens: (body as any).max_completion_tokens,
        temperature: body.temperature,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stop: body.stop,
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": this.config.apiKey ?? "",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal,
    });
    for await (const chunk of streamSse(resp as any)) {
      yield chatChunk({
        content: chunk.choices[0].text,
        finish_reason: chunk.finish_reason,
        model: body.model,
      });
    }
  }
}
