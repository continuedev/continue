import {
  BedrockRuntimeClient,
  ContentBlock,
  ContentBlockDelta,
  ContentBlockStart,
  ContentBlockStartEvent,
  ConversationRole,
  ConverseStreamCommand,
  ConverseStreamCommandOutput,
  ImageFormat,
  InvokeModelCommand,
  Message,
  ReasoningContentBlockDelta,
  ToolConfiguration,
  ToolUseBlock,
  ToolUseBlockDelta,
} from "@aws-sdk/client-bedrock-runtime";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

import type { CompletionOptions } from "../../index.js";
import { ChatMessage, Chunk, LLMOptions, MessageContent } from "../../index.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { parseDataUrl } from "../../util/url.js";
import { BaseLLM } from "../index.js";
import { PROVIDER_TOOL_SUPPORT } from "../toolSupport.js";
import { getSecureID } from "../utils/getSecureID.js";
import { withLLMRetry } from "../utils/retry.js";

interface ModelConfig {
  formatPayload: (text: string) => any;
  extractEmbeddings: (responseBody: any) => number[][];
}

/**
 * Interface for prompt caching metrics
 */
interface PromptCachingMetrics {
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
}

class Bedrock extends BaseLLM {
  static providerName = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    profile: "bedrock",
  };

  private _promptCachingMetrics: PromptCachingMetrics = {
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
  };

  public requestOptions: {
    region?: string;
    credentials?: any;
    headers?: Record<string, string>;
  };

  constructor(options: LLMOptions) {
    super(options);
    if (!options.apiBase) {
      this.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }

    this.requestOptions = {
      region: options.region,
      headers: {},
    };
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, signal, options)) {
      yield renderChatMessage(update);
    }
  }

  @withLLMRetry()
  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.region,
      endpoint: this.apiBase,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    let config_headers =
      this.requestOptions && this.requestOptions.headers
        ? this.requestOptions.headers
        : {};
    // AWS SigV4 requires strict canonicalization of headers.
    // DO NOT USE "_" in your header name. It will return an error like below.
    // "The request signature we calculated does not match the signature you provided."

    client.middlewareStack.add(
      (next) => async (args: any) => {
        args.request.headers = {
          ...args.request.headers,
          ...config_headers,
        };
        return next(args);
      },
      {
        step: "build",
      },
    );

    const input = this._generateConverseInput(messages, {
      ...options,
      stream: true,
    });
    const command = new ConverseStreamCommand(input);

    const response = (await client.send(command, {
      abortSignal: signal,
    })) as ConverseStreamCommandOutput;

    if (!response?.stream) {
      throw new Error("No stream received from Bedrock API");
    }

    // Reset cache metrics for new request
    this._promptCachingMetrics = {
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    };

    try {
      for await (const chunk of response.stream) {
        if (chunk.metadata?.usage) {
          console.log(`${JSON.stringify(chunk.metadata.usage)}`);
        }

        const contentBlockDelta: ContentBlockDelta | undefined =
          chunk.contentBlockDelta?.delta;
        if (contentBlockDelta) {
          // Handle text content
          if (contentBlockDelta.text) {
            yield {
              role: "assistant",
              content: contentBlockDelta.text,
            };
            continue;
          }
          if (contentBlockDelta.reasoningContent?.text) {
            yield {
              role: "thinking",
              content: contentBlockDelta.reasoningContent.text,
            };
            continue;
          }
          if (contentBlockDelta.reasoningContent?.signature) {
            yield {
              role: "thinking",
              content: "",
              signature: contentBlockDelta.reasoningContent.signature,
            };
            continue;
          }
        }

        const reasoningDelta: ReasoningContentBlockDelta | undefined = chunk
          .contentBlockDelta?.delta as ReasoningContentBlockDelta;
        if (reasoningDelta) {
          if (reasoningDelta.redactedContent) {
            yield {
              role: "thinking",
              content: "",
              redactedThinking: reasoningDelta.text,
            };
            continue;
          }
        }

        const toolUseBlockDelta: ToolUseBlockDelta | undefined = chunk
          .contentBlockDelta?.delta?.toolUse as ToolUseBlockDelta;
        const toolUseBlock: ToolUseBlock | undefined = chunk.contentBlockDelta
          ?.delta?.toolUse as ToolUseBlock;
        if (toolUseBlockDelta && toolUseBlock) {
          yield {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: toolUseBlock.toolUseId,
                type: "function",
                function: {
                  name: toolUseBlock.name,
                  arguments: toolUseBlockDelta.input,
                },
              },
            ],
          };
          continue;
        }

        const contentBlockStart: ContentBlockStartEvent | undefined =
          chunk.contentBlockStart as ContentBlockStartEvent;
        if (contentBlockStart) {
          const start: ContentBlockStart | undefined = chunk.contentBlockStart
            ?.start as ContentBlockStart;
          if (start) {
            const toolUseBlock: ToolUseBlock | undefined =
              start.toolUse as ToolUseBlock;
            if (toolUseBlock?.toolUseId && toolUseBlock?.name) {
              yield {
                role: "assistant",
                content: "",
                toolCalls: [
                  {
                    id: toolUseBlock.toolUseId,
                    type: "function",
                    function: {
                      name: toolUseBlock.name,
                      arguments: "",
                    },
                  },
                ],
              };
              continue;
            }
          }
        }
      }
    } catch (error: unknown) {
      // Clean up state and let the original error bubble up to the retry decorator
      throw error;
    }
  }

  /**
   * Generates the input payload for the Bedrock Converse API
   * @param messages - Array of chat messages
   * @param options - Completion options
   * @returns Formatted input payload for the API
   */
  private _generateConverseInput(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): any {
    const systemMessage = stripImages(
      messages.find((m) => m.role === "system")?.content ?? "",
    );

    // Prompt and system message caching settings
    const shouldCacheSystemMessage =
      (!!systemMessage && this.cacheBehavior?.cacheSystemMessage) ||
      this.completionOptions.promptCaching;
    const enablePromptCaching =
      shouldCacheSystemMessage ||
      this.cacheBehavior?.cacheConversation ||
      this.completionOptions.promptCaching;

    if (enablePromptCaching) {
      this.requestOptions.headers = {
        ...this.requestOptions.headers,
        "x-amzn-bedrock-enablepromptcaching": "true",
      };
    }

    // First get tools
    const supportsTools =
      (this.capabilities?.tools ||
        PROVIDER_TOOL_SUPPORT.bedrock?.(options.model)) ??
      false;

    let toolConfig: undefined | ToolConfiguration = undefined;
    const availableTools = new Set<string>();
    if (supportsTools && options.tools && options.tools.length > 0) {
      toolConfig = {
        tools: options.tools.map((tool) => ({
          toolSpec: {
            name: tool.function.name,
            description: tool.function.description,
            inputSchema: {
              json: tool.function.parameters,
            },
          },
        })),
      } as ToolConfiguration;
      const shouldCacheToolsConfig = this.completionOptions.promptCaching;
      if (shouldCacheToolsConfig) {
        toolConfig.tools!.push({ cachePoint: { type: "default" } });
      }
      options.tools.forEach((tool) => {
        availableTools.add(tool.function.name);
      });
    }

    const convertedMessages = this._convertMessages(messages, availableTools);

    return {
      modelId: options.model,
      system: systemMessage
        ? shouldCacheSystemMessage
          ? [{ text: systemMessage }, { cachePoint: { type: "default" } }]
          : [{ text: systemMessage }]
        : undefined,
      toolConfig: toolConfig,
      messages: convertedMessages,
      inferenceConfig: {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        topP: options.topP,
        // TODO: The current approach selects the first 4 items from the list to comply with Bedrock's requirement
        // of having at most 4 stop sequences, as per the AWS documentation:
        // https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_InferenceConfiguration.html
        // However, it might be better to implement a strategy that dynamically selects the most appropriate stop sequences
        // based on the context.
        // TODO: Additionally, consider implementing a global exception handler for the providers to give users clearer feedback.
        // For example, differentiate between client-side errors (4XX status codes) and server-side issues (5XX status codes),
        // providing meaningful error messages to improve the user experience.
        stopSequences: options.stop
          ?.filter((stop) => stop.trim() !== "")
          .slice(0, 4),
      },
      additionalModelRequestFields: {
        thinking: options.reasoning
          ? {
              type: "enabled",
              budget_tokens: options.reasoningBudgetTokens,
            }
          : undefined,
        anthropic_beta: options.model.includes("claude")
          ? ["fine-grained-tool-streaming-2025-05-14"]
          : undefined,
      },
    };
  }

  /*
    Converts the messages to the format expected by the Bedrock API.
    
    */
  private _convertMessages(
    messages: ChatMessage[],
    availableTools: Set<string>,
  ): Message[] {
    let currentRole: "user" | "assistant" = "user";
    let currentBlocks: ContentBlock[] = [];

    const converted: Message[] = [];
    const pushCurrentMessage = () => {
      if (currentBlocks.length === 0 && converted.length > 1) {
        throw new Error(
          `Bedrock: no content in ${currentRole} message before conversational turn change`,
        );
      }
      if (currentBlocks.length > 0) {
        converted.push({
          role: currentRole,
          content: currentBlocks,
        });
      }
      currentBlocks = [];
    };

    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const hasAddedToolCallIds = new Set<string>();

    for (let idx = 0; idx < nonSystemMessages.length; idx++) {
      const message = nonSystemMessages[idx];

      if (message.role === "user" || message.role === "tool") {
        // Detect conversational turn change
        if (currentRole !== ConversationRole.USER) {
          pushCurrentMessage();
          currentRole = ConversationRole.USER;
        }

        // USER messages:
        // Non-empty user message content is converted to "text" and "image" blocks
        // If ANY user message part is cached, we add a single cache point block when we push the message
        if (message.role === "user") {
          const trimmedContent =
            typeof message.content === "string"
              ? message.content.trim()
              : message.content;
          if (trimmedContent) {
            currentBlocks.push(
              ...this._convertMessageContentToBlocks(trimmedContent),
            );
          }
        }
        // TOOL messages:
        // Tool messages are represented by "toolResult" blocks
        // toolResult blocks must follow valid toolUse blocks (which also verifies that the tool name is present in toolConfig)
        // If it doesn't, we convert it to a text block
        else if (message.role === "tool") {
          const trimmedContent = message.content.trim() || "No tool output";
          if (hasAddedToolCallIds.has(message.toolCallId)) {
            currentBlocks.push({
              toolResult: {
                toolUseId: message.toolCallId,
                content: [
                  {
                    text: trimmedContent,
                  },
                ],
              },
            });
          } else {
            currentBlocks.push({
              text: `Tool call output for Tool Call ID ${message.toolCallId}:\n\n${trimmedContent}`,
            });
          }
        }
      } else if (message.role === "assistant" || message.role === "thinking") {
        // Detect conversational turn change
        if (currentRole !== ConversationRole.ASSISTANT) {
          pushCurrentMessage();
          currentRole = ConversationRole.ASSISTANT;
        }

        // ASSISTANT messages:
        // Non-empty assistant message content is converted to "text" and "image" blocks
        if (message.role === "assistant") {
          const trimmedContent =
            typeof message.content === "string"
              ? message.content.trim()
              : message.content;
          if (trimmedContent) {
            currentBlocks.push(
              ...this._convertMessageContentToBlocks(trimmedContent),
            );
          }
          // TOOL CALLS:
          // Tool calls are represented by "toolUse" blocks
          // Each tool call must have an id and a function name
          // The function name must match one of the available tools
          // Otherwise, we will convert it to a text block (e.g. Chat mode will pass no tools)
          if (message.toolCalls) {
            for (const toolCall of message.toolCalls) {
              if (toolCall.id && toolCall.function?.name) {
                if (availableTools.has(toolCall.function.name)) {
                  currentBlocks.push({
                    toolUse: {
                      toolUseId: toolCall.id,
                      name: toolCall.function.name,
                      input: safeParseToolCallArgs(toolCall),
                    },
                  });
                  hasAddedToolCallIds.add(toolCall.id);
                } else {
                  const toolCallText = `Assistant tool call:\nTool name: ${toolCall.function.name}\nTool Call ID: ${toolCall.id}\nArguments: ${toolCall.function?.arguments ?? "{}"}`;
                  currentBlocks.push({
                    text: toolCallText,
                  });
                }
              } else {
                console.warn(
                  `Bedrock: tool call missing id or name, skipping tool call: ${JSON.stringify(toolCall)}`,
                );
                continue;
              }
            }
          }
        } else if (message.role === "thinking") {
          // THINKING:
          // Thinking messages are represented by "reasoningContent" blocks which can have redacted content or reasoning content
          if (message.redactedThinking) {
            const block: ContentBlock.ReasoningContentMember = {
              reasoningContent: {
                redactedContent: new Uint8Array(
                  Buffer.from(message.redactedThinking),
                ),
              },
            };
            currentBlocks.push(block);
          } else {
            const block: ContentBlock.ReasoningContentMember = {
              reasoningContent: {
                reasoningText: {
                  text: (message.content as string) || "",
                  signature: message.signature,
                },
              },
            };
            currentBlocks.push(block);
          }
        }
      }
    }
    if (currentBlocks.length > 0) {
      pushCurrentMessage();
    }

    // If caching is enabled, we add cache_control parameter to the last two user messages
    // The second-to-last because it retrieves potentially already cached contents,
    // The last one because we want it cached for later retrieval.
    // See: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
    if (
      this.cacheBehavior?.cacheConversation ||
      this.completionOptions.promptCaching
    ) {
      this._addCachingToLastTwoUserMessages(converted);
    }

    return converted;
  }

  private _addCachingToLastTwoUserMessages(converted: Message[]) {
    let numCached = 0;
    for (let i = converted.length - 1; i >= 0; i--) {
      const message = converted[i];
      if (message.role === "user") {
        message.content?.forEach((block) => {
          if (block.text) {
            block.text += getSecureID();
          }
        });
        message.content?.push({ cachePoint: { type: "default" } });
        numCached++;
      }
      if (numCached === 2) {
        break;
      }
    }
  }

  // Converts Continue message content (string/parts) to Bedrock ContentBlock format.
  // Unsupported/problematic image formats are skipped with a warning.
  private _convertMessageContentToBlocks(
    content: MessageContent,
  ): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    if (typeof content === "string") {
      blocks.push({ text: content });
    } else {
      for (const part of content) {
        if (part.type === "text") {
          blocks.push({ text: part.text });
        } else if (part.type === "imageUrl" && part.imageUrl) {
          const parsed = parseDataUrl(part.imageUrl.url);
          if (parsed) {
            const { mimeType, base64Data } = parsed;
            const format = mimeType.split("/")[1]?.split(";")[0] || "jpeg";
            if (
              format === ImageFormat.JPEG ||
              format === ImageFormat.PNG ||
              format === ImageFormat.WEBP ||
              format === ImageFormat.GIF
            ) {
              blocks.push({
                image: {
                  format,
                  source: {
                    bytes: Uint8Array.from(Buffer.from(base64Data, "base64")),
                  },
                },
              });
            } else {
              console.warn(
                `Bedrock: skipping unsupported image part format: ${format}`,
                part,
              );
            }
          } else {
            console.warn("Bedrock: failed to process image part", part);
          }
        }
      }
    }
    return blocks;
  }

  private async _getCredentials() {
    if (this.accessKeyId && this.secretAccessKey) {
      return {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      };
    }
    const profile = this.profile ?? "bedrock";
    try {
      return await fromNodeProviderChain({
        profile: profile,
        ignoreCache: true,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${profile} not found in ~/.aws/credentials, using default profile`,
      );
    }
    return await fromNodeProviderChain()();
  }

  // EMBED //
  async _embed(chunks: string[]): Promise<number[][]> {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    return (
      await Promise.all(
        chunks.map(async (chunk) => {
          const input = this._generateInvokeModelCommandInput(chunk);
          const command = new InvokeModelCommand(input);
          const response = await client.send(command);
          if (response.body) {
            const decoder = new TextDecoder();
            const decoded = decoder.decode(response.body);
            try {
              const responseBody = JSON.parse(decoded);
              return this._extractEmbeddings(responseBody);
            } catch (e) {
              console.error(`Error parsing response body from:\n${decoded}`, e);
            }
          }
          return [];
        }),
      )
    ).flat();
  }

  private _generateInvokeModelCommandInput(text: string): any {
    const modelConfig = this._getModelConfig();
    const payload = modelConfig.formatPayload(text);

    return {
      body: JSON.stringify(payload),
      modelId: this.model,
      accept: "*/*",
      contentType: "application/json",
    };
  }

  private _extractEmbeddings(responseBody: any): number[][] {
    const modelConfig = this._getModelConfig();
    return modelConfig.extractEmbeddings(responseBody);
  }

  private _getModelConfig() {
    const modelConfigs: { [key: string]: ModelConfig } = {
      cohere: {
        formatPayload: (text: string) => ({
          texts: [text],
          input_type: "search_document",
          truncate: "END",
        }),
        extractEmbeddings: (responseBody: any) => responseBody.embeddings || [],
      },
      "amazon.titan-embed": {
        formatPayload: (text: string) => ({
          inputText: text,
        }),
        extractEmbeddings: (responseBody: any) =>
          responseBody.embedding ? [responseBody.embedding] : [],
      },
    };

    const modelPrefix = Object.keys(modelConfigs).find((prefix) =>
      this.model!.startsWith(prefix),
    );
    if (!modelPrefix) {
      throw new Error(`Unsupported model: ${this.model}`);
    }
    return modelConfigs[modelPrefix];
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || !chunks.length) {
      throw new Error("Query and chunks must not be empty");
    }

    try {
      const credentials = await this._getCredentials();
      const client = new BedrockRuntimeClient({
        region: this.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken || "",
        },
      });

      // Base payload for both models
      const payload: any = {
        query: query,
        documents: chunks.map((chunk) => chunk.content),
        top_n: chunks.length,
      };

      // Add api_version for Cohere model
      if (this.model.startsWith("cohere.rerank")) {
        payload.api_version = 2;
      }

      const input = {
        body: JSON.stringify(payload),
        modelId: this.model,
        accept: "*/*",
        contentType: "application/json",
      };

      const command = new InvokeModelCommand(input);
      const response = await client.send(command);

      if (!response.body) {
        throw new Error("Empty response received from Bedrock");
      }

      const decoder = new TextDecoder();
      const decoded = decoder.decode(response.body);
      try {
        const responseBody = JSON.parse(decoded);
        // Sort results by index to maintain original order
        return responseBody.results
          .sort((a: any, b: any) => a.index - b.index)
          .map((result: any) => result.relevance_score);
      } catch (e) {
        throw new Error(
          `Error parsing JSON from Bedrock response body:\n${decoded}, ${JSON.stringify(e)}`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if ("code" in error) {
          // AWS SDK specific errors
          throw new Error(
            `AWS Bedrock rerank error (${(error as any).code}): ${error.message}`,
          );
        }
        throw new Error(`Error in BedrockReranker.rerank: ${error.message}`);
      }
      throw new Error(
        "Error in BedrockReranker.rerank: Unknown error occurred",
      );
    }
  }
}

export default Bedrock;
