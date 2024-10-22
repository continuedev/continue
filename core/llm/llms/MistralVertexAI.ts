import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider
} from "../../index.js";
import { stripImages } from "../images.js";
import { streamSse } from "../stream.js";
import { gptEditPrompt } from "../templates/edit.js";
import VertexAI from "./VertexAI.js";

class MistralVertexAI extends VertexAI {
  static providerName: ModelProvider = "mistral-vertexai";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-central1",
    model: "codestral-latest",
    promptTemplates: {
      edit: gptEditPrompt,
    },
  };

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    )) {
      yield stripImages(chunk.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiBase = this.apiBase!;
    const apiURL = new URL(
      `publishers/mistralai/models/${options.model}:streamRawPredict`,
      apiBase,
    );

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      (lastMessage as any).prefix = true;
    }

    const body = {
      model: options.model,
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens,
      stream: options.stream ?? true,
      stop: options.stop,
      messages,
    };

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for await (const chunk of streamSse(response)) {
      yield chunk.choices[0].delta;
    }
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const apiBase = this.apiBase!;
    const apiURL = new URL(
      `publishers/mistralai/models/${options.model}:streamRawPredict`,
      apiBase,
    );

    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      stream: options.stream ?? true,
      stop: options.stop,
      prompt: prefix,
      suffix,
    };

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for await (const chunk of streamSse(response)) {
      yield chunk.choices[0].delta.content;
    }
  }

  supportsFim(): boolean {
    return true;
  }
}

export default MistralVertexAI;
