import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  Model,
} from "openai/resources/index";
import { z } from "zod";
import { BedrockConfigSchema } from "../types.js";
import { chatChunk, model } from "../util.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class BedrockApi implements BaseLlmApi {
  private client: AnthropicBedrock;
  constructor(protected config: z.infer<typeof BedrockConfigSchema>) {
    this.client = new AnthropicBedrock({
      awsRegion: config.env.region ?? "us-east-1",
      // The SDK will automatically use AWS credentials from environment or ~/.aws/credentials
      // If profile is specified, we might need to handle it differently
      awsAccessKey: config.env.awsAccessKey,
      awsSecretKey: config.env.awsSecretKey,
    });
  }

  private convertMessagesToAnthropicFormat(messages: any[]): any[] {
    return messages.map((message) => {
      if (message.role === "system") {
        // Anthropic handles system messages differently - they're usually prepended to the first user message
        return {
          role: "user",
          content: `System: ${message.content}\n\nUser: `,
        };
      }

      return {
        role: message.role === "assistant" ? "assistant" : "user",
        content:
          typeof message.content === "string"
            ? message.content
            : Array.isArray(message.content)
              ? message.content
                  .map(
                    (item: any) =>
                      item.text || item.content || JSON.stringify(item),
                  )
                  .join("\n")
              : String(message.content),
      };
    });
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    throw new Error(
      "Non-streaming chat completion not implemented for Bedrock",
    );
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    try {
      const messages = this.convertMessagesToAnthropicFormat(body.messages);

      const stream = await this.client.messages.create({
        model: body.model,
        messages,
        max_tokens: body.max_tokens || 4096,
        temperature: body.temperature ?? undefined,
        top_p: body.top_p ?? undefined,
        stream: true,
      });

      for await (const event of stream) {
        if (signal.aborted) {
          throw new Error("Request was aborted");
        }

        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          yield chatChunk({
            content: event.delta.text,
            model: body.model,
          });
        }

        if (event.type === "message_stop") {
          yield chatChunk({
            content: null,
            model: body.model,
            finish_reason: "stop",
          });
          break;
        }

        // Handle usage information if available
        if (event.type === "message_delta" && event.usage) {
          yield chatChunk({
            content: null,
            model: body.model,
            usage: {
              prompt_tokens: event.usage.input_tokens || 0,
              completion_tokens: event.usage.output_tokens || 0,
              total_tokens:
                (event.usage.input_tokens || 0) +
                (event.usage.output_tokens || 0),
            },
          });
        }
      }
    } catch (error) {
      if (signal.aborted) {
        throw new Error("Request was aborted");
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Bedrock API error: ${message}`);
    }
  }

  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    throw new Error("Completion API not supported by Bedrock");
  }

  async *completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion, any, unknown> {
    throw new Error("Completion API not supported by Bedrock");
  }

  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    throw new Error("Fill-in-the-middle not supported by Bedrock");
  }

  async embed(body: any): Promise<any> {
    throw new Error("Embeddings not implemented for Bedrock in this adapter");
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("Reranking not implemented for Bedrock in this adapter");
  }

  async list(): Promise<Model[]> {
    // Return common Bedrock models that work with Anthropic SDK
    const commonModels = [
      "anthropic.claude-3-5-sonnet-20240620-v1:0",
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "anthropic.claude-3-haiku-20240307-v1:0",
      "anthropic.claude-3-opus-20240229-v1:0",
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    ];

    return commonModels.map((modelId) =>
      model({
        id: modelId,
        owned_by: "amazon-bedrock",
      }),
    );
  }
}
