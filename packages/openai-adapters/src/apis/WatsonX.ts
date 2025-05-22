import { streamSse } from "@continuedev/fetch";
import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from "openai/resources/index";
import { ChatCompletionCreateParams } from "openai/src/resources/index.js";
import { WatsonXConfig } from "../types.js";
import { customFetch } from "../util.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class WatsonXApi implements BaseLlmApi {
  apiBase: string;
  apiVersion: string = "2023-05-29";
  projectId?: string;
  deploymentId?: string;

  constructor(protected config: WatsonXConfig) {
    this.apiBase = config.apiBase ?? "https://us-south.ml.cloud.ibm.com";
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
    this.apiVersion = config.apiVersion ?? this.apiVersion;
    this.projectId = config.projectId;
    this.deploymentId = config.deploymentId;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private getEndpoint(endpoint: string): string {
    return `${this.apiBase}ml/v1/${this.deploymentId ? `deployments/${this.deploymentId}/` : ""}text/${endpoint}_stream?version=${this.apiVersion}`;
  }

  private _convertBody(oaiBody: ChatCompletionCreateParams) {
    const stopSequences = oaiBody.stop
      ? Array.isArray(oaiBody.stop)
        ? oaiBody.stop.filter((s) => s.trim() !== "")
        : [oaiBody.stop]
      : undefined;

    const payload: any = {
      messages: oaiBody.messages,
      max_tokens: oaiBody.max_tokens ?? 1024,
      stop: stopSequences,
      frequency_penalty: oaiBody.frequency_penalty,
      presence_penalty: oaiBody.presence_penalty,
    };

    if (!this.deploymentId) {
      payload.model_id = oaiBody.model;
      payload.project_id = this.projectId;
    }

    if (oaiBody.temperature !== undefined) {
      payload.temperature = oaiBody.temperature;
    }

    if (oaiBody.top_p !== undefined) {
      payload.top_p = oaiBody.top_p;
    }

    if (oaiBody.tools) {
      payload.tools = oaiBody.tools;
      if (oaiBody.tool_choice) {
        payload.tool_choice = oaiBody.tool_choice;
      } else {
        payload.tool_choice_option = "auto";
      }
    }

    return payload;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    throw new Error("Method not implemented.");
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const url = this.getEndpoint("chat");
    const response = await customFetch(this.config.requestOptions)(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(this._convertBody(body)),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to stream chat completion: ${await response.text()}`,
      );
    }

    for await (const value of streamSse(response as any)) {
      const chunk = value;
      yield chunk;
    }
  }

  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    throw new Error("Method not implemented.");
  }

  async *completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion, any, unknown> {
    const params = {
      decoding_method: body.temperature ? "sample" : "greedy",
      max_new_tokens: body.max_tokens ?? 1024,
      min_new_tokens: 1,
      stop_sequences: body.stop
        ? Array.isArray(body.stop)
          ? body.stop
          : [body.stop]
        : [],
      include_stop_sequence: false,
      repetition_penalty: body.frequency_penalty || 1,
      temperature: body.temperature,
      top_p: body.top_p,
      top_k: 100,
    };

    const payload: any = {
      input: body.prompt,
      parameters: params,
    };

    if (!this.deploymentId) {
      payload.model_id = body.model;
      payload.project_id = this.projectId;
    }

    const url = this.getEndpoint("generation");
    const response = await customFetch(this.config.requestOptions)(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to stream completion: ${await response.text()}`);
    }

    let generatedText = "";
    for await (const value of streamSse(response as any)) {
      const lines = value.toString().split("\n");
      let generatedChunk = "";

      lines.forEach((line: string) => {
        if (line.startsWith("data:")) {
          const dataStr = line.replace(/^data:\s+/, "");
          try {
            const data = JSON.parse(dataStr);
            data.results.forEach((result: any) => {
              generatedChunk += result.generated_text || "";
            });
          } catch (e) {
            // parsing error is expected with streaming response
          }
        }
      });

      if (generatedChunk) {
        generatedText += generatedChunk;
        yield {
          id: `watsonx-${Date.now()}`,
          object: "text_completion",
          created: Date.now(),
          model: body.model,
          choices: [
            {
              text: generatedChunk,
              index: 0,
              logprobs: null,
              finish_reason: "stop",
            },
          ],
        };
      }
    }
  }

  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    throw new Error("Method not implemented.");
  }

  async embed(
    body: OpenAI.Embeddings.EmbeddingCreateParams,
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    throw new Error("Method not implemented.");
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("Method not implemented.");
  }

  async list(): Promise<OpenAI.Models.Model[]> {
    throw new Error("Method not implemented.");
  }
}
