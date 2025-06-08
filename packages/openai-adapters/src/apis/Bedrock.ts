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
import { chatChunk, chatChunkFromDelta } from "../util.js";
import { EMPTY_CHAT_COMPLETION } from "../util/emptyChatCompletion.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

interface ToolUseState {
  toolUseId: string;
  name: string;
  input: string;
}

export class BedrockApi implements BaseLlmApi {
  private client: AnthropicBedrock;
  private _currentToolResponse: Partial<ToolUseState> | null = null;

  constructor(protected config: z.infer<typeof BedrockConfigSchema>) {
    this.client = new AnthropicBedrock({
      awsRegion: config.env.region ?? "us-east-1",
      awsAccessKey: config.env.awsAccessKey,
      awsSecretKey: config.env.awsSecretKey,
    });
  }

  private _convertBody(oaiBody: any) {
    let stop = undefined;
    if (oaiBody.stop && Array.isArray(oaiBody.stop)) {
      stop = oaiBody.stop.filter((x: string) => x.trim() !== "");
    } else if (typeof oaiBody.stop === "string" && oaiBody.stop.trim() !== "") {
      stop = [oaiBody.stop];
    }

    const systemMessage = oaiBody.messages.find(
      (msg: any) => msg.role === "system",
    )?.content;

    // Convert tool_choice to proper Anthropic format
    let toolChoice: any = undefined;
    if (oaiBody.tool_choice) {
      if (typeof oaiBody.tool_choice === "string") {
        if (oaiBody.tool_choice === "auto") {
          toolChoice = { type: "auto" };
        } else if (oaiBody.tool_choice === "required") {
          toolChoice = { type: "any" };
        } else if (oaiBody.tool_choice === "none") {
          toolChoice = { type: "none" };
        }
      } else if (oaiBody.tool_choice?.function?.name) {
        toolChoice = {
          type: "tool",
          name: oaiBody.tool_choice.function.name,
        };
      }
    }

    const anthropicBody: any = {
      messages: this._convertMessages(
        oaiBody.messages.filter((msg: any) => msg.role !== "system"),
      ),
      system: systemMessage
        ? [
            {
              type: "text",
              text: systemMessage,
              cache_control: { type: "ephemeral" },
            },
          ]
        : undefined,
      top_p: oaiBody.top_p,
      temperature: oaiBody.temperature,
      max_tokens: oaiBody.max_tokens ?? 4096,
      model: oaiBody.model,
      stop_sequences: stop?.slice(0, 4), // Bedrock supports max 4 stop sequences
      stream: oaiBody.stream,
      tools: oaiBody.tools?.map((tool: any) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      })),
      tool_choice: toolChoice,
    };

    return anthropicBody;
  }

  private _convertMessages(msgs: any[]): any[] {
    const messages = msgs.map((message) => {
      if (message.role === "tool") {
        return {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: message.tool_call_id,
              content:
                typeof message.content === "string"
                  ? message.content
                  : Array.isArray(message.content)
                    ? message.content
                        .map(
                          (part: any) =>
                            part.text || part.content || JSON.stringify(part),
                        )
                        .join("")
                    : String(message.content),
            },
          ],
        };
      } else if (message.role === "assistant" && message.tool_calls) {
        return {
          role: "assistant" as const,
          content: message.tool_calls.map((toolCall: any) => ({
            type: "tool_use" as const,
            id: toolCall.id,
            name: toolCall.function?.name,
            input: JSON.parse(toolCall.function?.arguments || "{}"),
          })),
        };
      }

      if (!Array.isArray(message.content)) {
        return message;
      }

      return {
        ...message,
        content: message.content
          .map((part: any) => {
            if (part.type === "text") {
              if ((part.text?.trim() ?? "") === "") {
                return null;
              }
              return part;
            }
            if (part.type === "imageUrl" || part.type === "image_url") {
              const imageUrl = part.imageUrl || part.image_url;
              if (imageUrl?.url) {
                try {
                  const [mimeType, base64Data] = imageUrl.url.split(",");
                  const mediaType =
                    mimeType.replace("data:", "").split(";")[0] || "image/jpeg";
                  return {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: mediaType,
                      data: base64Data,
                    },
                  };
                } catch (error) {
                  console.warn(`Failed to process image: ${error}`);
                  return null;
                }
              }
            }
            return null;
          })
          .filter((x: any) => x !== null),
      };
    });
    return messages;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    try {
      const anthropicBody = this._convertBody(body);

      const response = await this.client.messages.create({
        ...anthropicBody,
        stream: false,
      } as any);

      if (signal.aborted) {
        return EMPTY_CHAT_COMPLETION;
      }

      // Convert Anthropic response to OpenAI format
      const content = response.content
        .map((block: any) => {
          if (block.type === "text") {
            return block.text;
          }
          return "";
        })
        .join("");

      const toolCalls = response.content
        .filter((block: any) => block.type === "tool_use")
        .map((block: any, index: number) => ({
          id: block.id,
          type: "function" as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        }));

      return {
        id: response.id || `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        model: body.model,
        created: Date.now(),
        usage: {
          total_tokens:
            (response.usage?.input_tokens || 0) +
            (response.usage?.output_tokens || 0),
          completion_tokens: response.usage?.output_tokens || 0,
          prompt_tokens: response.usage?.input_tokens || 0,
        },
        choices: [
          {
            logprobs: null,
            finish_reason:
              response.stop_reason === "end_turn"
                ? "stop"
                : (response.stop_reason as any) || "stop",
            message: {
              role: "assistant",
              content: content || null,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              refusal: null,
            },
            index: 0,
          },
        ],
      };
    } catch (error) {
      if (signal.aborted) {
        return EMPTY_CHAT_COMPLETION;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Bedrock API error: ${message}`);
    }
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    try {
      const anthropicBody = this._convertBody(body);

      const stream = await this.client.messages.create({
        ...anthropicBody,
        stream: true,
      });
      this._currentToolResponse = null;
      let lastToolUseId: string | undefined;
      let lastToolUseName: string | undefined;

      for await (const event of stream as any) {
        if (signal.aborted) {
          throw new Error("Request was aborted");
        }

        switch (event.type) {
          case "content_block_start":
            if (event.content_block?.type === "tool_use") {
              lastToolUseId = event.content_block.id;
              lastToolUseName = event.content_block.name;
              this._currentToolResponse = {
                toolUseId: lastToolUseId,
                name: lastToolUseName,
                input: "",
              };
            }
            break;

          case "content_block_delta":
            if (event.delta?.type === "text_delta") {
              yield chatChunk({
                content: event.delta.text,
                model: body.model,
              });
            } else if (event.delta?.type === "input_json_delta") {
              if (!lastToolUseId || !lastToolUseName) {
                break;
              }

              if (this._currentToolResponse) {
                this._currentToolResponse.input +=
                  event.delta.partial_json || "";
              }

              yield chatChunkFromDelta({
                model: body.model,
                delta: {
                  tool_calls: [
                    {
                      id: lastToolUseId,
                      type: "function",
                      index: 0,
                      function: {
                        name: lastToolUseName,
                        arguments: event.delta.partial_json || "",
                      },
                    },
                  ],
                },
              });
            }
            break;

          case "content_block_stop":
            if (this._currentToolResponse) {
              // Tool use completed - the arguments have been streamed via deltas
              this._currentToolResponse = null;
            }
            lastToolUseId = undefined;
            lastToolUseName = undefined;
            break;

          case "message_stop":
            yield chatChunk({
              content: null,
              model: body.model,
              finish_reason: "stop",
            });
            break;

          case "message_delta":
            if (event.usage) {
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
            break;
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
    throw new Error("/v1/models not implemented");
  }
}
