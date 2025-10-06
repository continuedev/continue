import {
  ContentBlockParam,
  MessageCreateParams,
  MessageParam,
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawMessageDeltaEvent,
  RawMessageStartEvent,
  RawMessageStreamEvent,
  Tool,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources";
import { streamSse } from "@continuedev/fetch";
import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionContentPartRefusal,
  ChatCompletionContentPartText,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CompletionUsage,
} from "openai/resources/index";
import { ChatCompletionCreateParams } from "openai/resources/index.js";
import { AnthropicConfig } from "../types.js";
import {
  chatChunk,
  chatChunkFromDelta,
  customFetch,
  usageChatChunk,
} from "../util.js";
import { EMPTY_CHAT_COMPLETION } from "../util/emptyChatCompletion.js";
import { safeParseArgs } from "../util/parseArgs.js";
import {
  CACHING_STRATEGIES,
  CachingStrategyName,
} from "./AnthropicCachingStrategies.js";
import {
  getAnthropicHeaders,
  getAnthropicMediaTypeFromDataUrl,
  openAiToolChoiceToAnthropicToolChoice,
  openaiToolToAnthropicTool,
} from "./AnthropicUtils.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class AnthropicApi implements BaseLlmApi {
  apiBase: string = "https://api.anthropic.com/v1/";

  constructor(
    protected config: AnthropicConfig & {
      cachingStrategy?: CachingStrategyName;
    },
  ) {
    this.apiBase = config.apiBase ?? this.apiBase;
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
  }

  private _convertBody(oaiBody: ChatCompletionCreateParams) {
    // Step 1: Convert to clean Anthropic body (no caching)
    const cleanBody = this._convertToCleanAnthropicBody(oaiBody);

    // Step 2: Apply caching strategy
    const cachingStrategy =
      CACHING_STRATEGIES[this.config.cachingStrategy ?? "systemAndTools"];
    return cachingStrategy(cleanBody);
  }

  private maxTokensForModel(model: string): number {
    if (model.includes("haiku")) {
      return 8192;
    }
    return 32_000;
  }

  public _convertToCleanAnthropicBody(
    oaiBody: ChatCompletionCreateParams,
  ): MessageCreateParams {
    let stop = undefined;
    if (oaiBody.stop && Array.isArray(oaiBody.stop)) {
      stop = oaiBody.stop.filter((x) => x.trim() !== "");
    } else if (typeof oaiBody.stop === "string" && oaiBody.stop.trim() !== "") {
      stop = [oaiBody.stop];
    }

    const systemMessage = oaiBody.messages.find(
      (msg) => msg.role === "system",
    )?.content;

    // TODO support custom tools
    const functionTools = oaiBody.tools?.filter((t) => t.type === "function");
    let tools: Tool[] | undefined = undefined;

    if (
      oaiBody.tool_choice !== "none" &&
      functionTools &&
      functionTools.length > 0
    ) {
      if (
        typeof oaiBody.tool_choice !== "string" &&
        oaiBody.tool_choice?.type === "allowed_tools"
      ) {
        const allowedToolNames = new Set(
          oaiBody.tool_choice?.allowed_tools.tools.map(
            (tool) => tool["name"],
          ) ?? [],
        );
        const allowedTools = functionTools.filter((t) =>
          allowedToolNames.has(t.function.name),
        );
        tools = allowedTools.map(openaiToolToAnthropicTool);
      } else {
        tools = functionTools.map(openaiToolToAnthropicTool);
      }
    }

    const anthropicBody: MessageCreateParams = {
      messages: this._convertMessages(
        oaiBody.messages.filter((msg) => msg.role !== "system"),
      ),
      system:
        typeof systemMessage === "string"
          ? [
              {
                type: "text",
                text: systemMessage,
              },
            ]
          : systemMessage,
      top_p: oaiBody.top_p ?? undefined,
      temperature: oaiBody.temperature ?? undefined,
      max_tokens: oaiBody.max_tokens ?? this.maxTokensForModel(oaiBody.model), // max_tokens is required
      model: oaiBody.model,
      stop_sequences: stop,
      stream: oaiBody.stream ?? undefined,
      tools,
      tool_choice: openAiToolChoiceToAnthropicToolChoice(oaiBody.tool_choice),
    };

    return anthropicBody;
  }

  private convertToolCallsToBlocks(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall,
  ): ToolUseBlock | undefined {
    const toolCallId = toolCall.id;
    const toolName = toolCall.function?.name;
    if (toolCallId && toolName) {
      return {
        type: "tool_use",
        id: toolCallId,
        name: toolName,
        input: safeParseArgs(
          toolCall.function.arguments,
          `${toolName} ${toolCallId}`,
        ),
      };
    }
  }

  // 1. ignores empty content
  // 2. converts string content to text parts
  // 3. converts text and refusal parts to text blocks
  // 4. converts image parts to image blocks
  private convertMessageContentToBlocks(
    content:
      | string
      | OpenAI.Chat.Completions.ChatCompletionContentPart[]
      | (ChatCompletionContentPartText | ChatCompletionContentPartRefusal)[],
  ): ContentBlockParam[] {
    const blocks: ContentBlockParam[] = [];
    if (typeof content === "string") {
      if (content) {
        blocks.push({
          type: "text",
          text: content,
        });
      }
    } else {
      const supportedParts = content.filter(
        (p) =>
          p.type === "text" || p.type === "image_url" || p.type === "refusal",
      );
      for (const part of supportedParts) {
        if (part.type === "image_url") {
          const dataUrl = part.image_url.url;
          if (dataUrl?.startsWith("data:")) {
            blocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: getAnthropicMediaTypeFromDataUrl(dataUrl),
                data: (() => {
                  const urlParts = dataUrl.split(",");
                  if (urlParts.length < 2) {
                    throw new Error("Invalid data URL format: missing comma separator");
                  }
                  const [, ...base64Parts] = urlParts;
                  return base64Parts.join(",");
                })(),
              },
            });
          }
        } else {
          const text = part.type === "text" ? part.text : part.refusal;
          if (text) {
            blocks.push({
              type: "text",
              text,
            });
          }
        }
      }
    }
    return blocks;
  }

  private getContentBlocksFromChatMessage(
    message: OpenAI.Chat.Completions.ChatCompletionMessageParam,
  ): ContentBlockParam[] {
    switch (message.role) {
      // One tool message = one tool_result block
      case "tool":
        return [
          {
            type: "tool_result",
            tool_use_id: message.tool_call_id,
            content: message.content,
          },
        ];
      case "user":
        return this.convertMessageContentToBlocks(message.content);
      case "assistant":
        const blocks: ContentBlockParam[] = message.content
          ? this.convertMessageContentToBlocks(message.content)
          : [];
        // If any tool calls are present, always put them last
        // Loses order vs what was originally sent, but they typically come last
        for (const toolCall of message.tool_calls ?? []) {
          if (toolCall.type !== "function") {
            // TODO support custom tool calls
            continue;
          }
          const block = this.convertToolCallsToBlocks(toolCall);
          if (block) {
            blocks.push(block);
          }
        }
        return blocks;
      // system, etc.
      default:
        return [];
    }
  }

  private _convertMessages(
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): MessageParam[] {
    const nonSystemMessages = msgs.filter((m) => m.role !== "system");

    const convertedMessages: MessageParam[] = [];
    let currentRole: "user" | "assistant" | undefined = undefined;
    let currentParts: ContentBlockParam[] = [];

    const flushCurrentMessage = () => {
      if (currentRole && currentParts.length > 0) {
        convertedMessages.push({
          role: currentRole,
          content: currentParts,
        });
        currentParts = [];
      }
    };

    for (const message of nonSystemMessages) {
      const newRole =
        message.role === "user" || message.role === "tool"
          ? "user"
          : "assistant";
      if (currentRole !== newRole) {
        flushCurrentMessage();
        currentRole = newRole;
      }
      currentParts.push(...this.getContentBlocksFromChatMessage(message));
    }
    flushCurrentMessage();

    return convertedMessages;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const response = await customFetch(this.config.requestOptions)(
      new URL("messages", this.apiBase),
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(this._convertBody(body)),
        signal,
      },
    );

    if (response.status === 499) {
      return EMPTY_CHAT_COMPLETION;
    }

    const completion = await response.json();

    const usage: Record<string, number> | undefined = completion.usage;
    return {
      id: completion.id,
      object: "chat.completion",
      model: body.model,
      created: Date.now(),
      usage: {
        total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
        completion_tokens: usage?.output_tokens ?? 0,
        prompt_tokens: usage?.input_tokens ?? 0,
        prompt_tokens_details: {
          cached_tokens: usage?.cache_read_input_tokens ?? 0,
        },
      },
      choices: [
        {
          logprobs: null,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: completion.content[0].text,
            refusal: null,
          },
          index: 0,
        },
      ],
    };
  }

  // This is split off so e.g. VertexAI can use it
  async *handleStreamResponse(response: any, model: string) {
    let lastToolUseId: string | undefined;
    let lastToolUseName: string | undefined;

    const usage: CompletionUsage = {
      completion_tokens: 0,
      prompt_tokens: 0,
      total_tokens: 0,
    };
    for await (const event of streamSse(response)) {
      // https://docs.anthropic.com/en/api/messages-streaming#event-types
      const rawEvent = event as RawMessageStreamEvent;
      switch (rawEvent.type) {
        case "content_block_start":
          const blockStartEvent = rawEvent as RawContentBlockStartEvent;
          if (blockStartEvent.content_block.type === "tool_use") {
            lastToolUseId = blockStartEvent.content_block.id;
            lastToolUseName = blockStartEvent.content_block.name;
          }
          break;
        case "message_start":
          const startEvent = rawEvent as RawMessageStartEvent;
          usage.prompt_tokens = startEvent.message.usage?.input_tokens ?? 0;
          usage.prompt_tokens_details = {
            cached_tokens:
              startEvent.message.usage?.cache_read_input_tokens ?? 0,
          };
          break;
        case "message_delta":
          const deltaEvent = rawEvent as RawMessageDeltaEvent;
          usage.completion_tokens = deltaEvent.usage?.output_tokens ?? 0;
          break;
        case "content_block_delta":
          // https://docs.anthropic.com/en/api/messages-streaming#delta-types
          const blockDeltaEvent = rawEvent as RawContentBlockDeltaEvent;
          switch (blockDeltaEvent.delta.type) {
            case "text_delta":
              yield chatChunk({
                content: blockDeltaEvent.delta.text,
                model,
              });
              break;
            case "input_json_delta":
              if (!lastToolUseId || !lastToolUseName) {
                throw new Error("No tool use found");
              }
              yield chatChunkFromDelta({
                model,
                delta: {
                  tool_calls: [
                    {
                      id: lastToolUseId,
                      type: "function",
                      index: 0,
                      function: {
                        name: lastToolUseName,
                        arguments: blockDeltaEvent.delta.partial_json,
                      },
                    },
                  ],
                },
              });
              break;
          }
          break;
        case "content_block_stop":
          lastToolUseId = undefined;
          lastToolUseName = undefined;
          break;
        default:
          break;
      }
    }

    yield usageChatChunk({
      model,
      usage: {
        ...usage,
        total_tokens: usage.completion_tokens + usage.prompt_tokens,
      },
    });
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const response = await customFetch(this.config.requestOptions)(
      new URL("messages", this.apiBase),
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(this._convertBody(body)),
        signal,
      },
    );
    yield* this.handleStreamResponse(response, body.model);
  }

  private getHeaders(): Record<string, string> {
    const enableCaching = this.config?.cachingStrategy !== "none";
    return getAnthropicHeaders(this.config.apiKey, enableCaching);
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
  ): AsyncGenerator<Completion> {
    throw new Error("Method not implemented.");
  }
  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
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

  list(): Promise<OpenAI.Models.Model[]> {
    throw new Error("Method not implemented.");
  }
}
