import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

import {
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
  MessageContent,
} from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

interface ModelConfig {
  formatPayload: (text: string) => any;
  extractEmbeddings: (responseBody: any) => number[][];
}

/**
 * Interface for tool use state tracking
 */
interface ToolUseState {
  toolUseId: string;
  name: string;
  input: string;
}

class Bedrock extends BaseLLM {
  static providerName = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    contextLength: 200_000,
    profile: "bedrock",
  };

  private _currentToolResponse: Partial<ToolUseState> | null = null;

  public requestOptions: { region?: string; credentials?: any; headers?: Record<string, string> };

  constructor(options: LLMOptions) {
    super(options);
    if (!options.apiBase) {
      this.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }
    if (options.profile) {
      this.profile = options.profile;
    } else {
      this.profile = "bedrock";
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

    // Add custom headers if provided
    if (this.requestOptions && this.requestOptions.headers) {
      client.middlewareStack.add(
        (next) => async (args: any) => {
          args.request.headers = {
            ...args.request.headers,
            ...this.requestOptions.headers,
          };
          return next(args);
        },
        { step: "build" }
      );
    }

    const input = this._generateConverseInput(messages, { ...options, stream: true });
    const command = new ConverseStreamCommand(input);

    let response;
    try {
      response = await client.send(command, { abortSignal: signal });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to communicate with Bedrock API: ${message}`);
    }

    if (!response?.stream) {
      throw new Error("No stream received from Bedrock API");
    }

    try {
      for await (const chunk of response.stream) {

        console.log(chunk);

        if (chunk.contentBlockDelta?.delta) {

          // Handle text content
          if (chunk.contentBlockDelta.delta.text) {
            yield { role: "assistant", content: chunk.contentBlockDelta.delta.text };
            continue;
          }

          if (chunk.contentBlockDelta.delta.toolUse?.input && this._currentToolResponse) {
            // Append the new input to the existing string
            if (this._currentToolResponse.input === undefined) {
              this._currentToolResponse.input = "";
            }
            this._currentToolResponse.input += chunk.contentBlockDelta.delta.toolUse.input;
            continue;
          }
        }

        if (chunk.contentBlockStart?.start) {
          const toolUse = chunk.contentBlockStart.start.toolUse;
          if (toolUse?.toolUseId && toolUse?.name) {
            this._currentToolResponse = {
              toolUseId: toolUse.toolUseId,
              name: toolUse.name,
              input: ""
            };
          }
          continue;
        }

        if (chunk.contentBlockStop) {
          if (this._currentToolResponse) {
            yield {
              role: "assistant",
              content: "",
              toolCalls: [{
                id: this._currentToolResponse.toolUseId,
                type: "function",
                function: {
                  name: this._currentToolResponse.name,
                  arguments: this._currentToolResponse.input
                }
              }],
            };
            this._currentToolResponse = null;
          }
          continue;
        }
      }
    } catch (error: unknown) {
      this._currentToolResponse = null;
      if (error instanceof Error) {
        if ("code" in error) {
          // AWS SDK specific errors
          throw new Error(`AWS Bedrock stream error (${(error as any).code}): ${error.message}`);
        }
        throw new Error(`Error processing Bedrock stream: ${error.message}`);
      }
      throw new Error("Error processing Bedrock stream: Unknown error occurred");
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
    const convertedMessages = this._convertMessages(messages);

    const isClaudeModel = options.model?.toLowerCase().includes("claude");
    return {
      modelId: options.model,
      messages: convertedMessages,
      system: this.systemMessage ? [{ text: this.systemMessage }] : undefined,
      toolConfig: isClaudeModel && options.tools ? {
        tools: options.tools.map(tool => ({
          toolSpec: {
            name: tool.function.name,
            description: tool.function.description,
            inputSchema: {
              json: tool.function.parameters
            }
          }
        }))
      } : undefined,
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
    };
  }

  private _convertMessage(message: ChatMessage): any {
    // Handle system messages explicitly
    if (message.role === "system") {
      return;
    }

    // Tool response handling
    if (message.role === "tool") {
      return {
        role: "user",
        content: [
          {
            toolResult: {
              toolUseId: message.toolCallId,
              content: [
                {
                  text: message.content || ""
                }
              ]
            }
          }
        ]
      };
    }

    // Tool calls handling
    if (message.role === "assistant" && message.toolCalls) {
      return {
        role: "assistant",
        content: message.toolCalls.map((toolCall) => ({
            toolUse: {
              toolUseId: toolCall.id,
              name: toolCall.function?.name,
              input: JSON.parse(toolCall.function?.arguments || "{}"),
            }
        }))
      };
    }

    // Standard text message
    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: [{ text: message.content }]
      };
    }

    // Improved multimodal content handling
    if (Array.isArray(message.content)) {
      return {
        role: message.role,
        content: message.content.map(part => {
          if (part.type === "text") {
            return { text: part.text };
          }
          if (part.type === "imageUrl" && part.imageUrl) {
            try {
              const [mimeType, base64Data] = part.imageUrl.url.split(",");
              const format = mimeType.split("/")[1]?.split(";")[0] || "jpeg";
              return {
                image: {
                  format,
                  source: {
                    bytes: Buffer.from(base64Data, "base64")
                  }
                }
              };
            } catch (error) {
              console.warn(`Failed to process image: ${error}`);
              return null;
            }
          }
          return null;
        }).filter(Boolean)
      };
    }
  }

  private _convertMessages(messages: ChatMessage[]): any[] {
    return messages
      .map((message) => {
        try {
          return this._convertMessage(message);
        } catch (error) {
          console.error(`Failed to convert message: ${error}`);
          return null;
        }
      })
      .filter(Boolean);
  }

  private async _getCredentials() {
    try {
      return await fromIni({
        profile: this.profile,
        ignoreCache: true,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${this.profile} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }

  // EMBED //
  async embed(chunks: string[]): Promise<number[][]> {
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
            const responseBody = JSON.parse(
              new TextDecoder().decode(response.body),
            );
            return this._extractEmbeddings(responseBody);
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
        credentials,
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

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Sort results by index to maintain original order
      return responseBody.results
        .sort((a: any, b: any) => a.index - b.index)
        .map((result: any) => result.relevance_score);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if ('code' in error) {
          // AWS SDK specific errors
          throw new Error(`AWS Bedrock rerank error (${(error as any).code}): ${error.message}`);
        }
        throw new Error(`Error in BedrockReranker.rerank: ${error.message}`);
      }
      throw new Error('Error in BedrockReranker.rerank: Unknown error occurred');
    }
  }
}

export default Bedrock;
