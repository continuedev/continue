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

class Bedrock extends BaseLLM {
  static providerName = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    contextLength: 200_000,
    profile: "bedrock",
  };

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

    const input = this._generateConverseInput(messages, options);
    const command = new ConverseStreamCommand(input);
    const response = await client.send(command, { abortSignal: signal });

    if (response.stream) {
      for await (const chunk of response.stream) {
        if (chunk.contentBlockDelta?.delta?.text) {
          yield {
            role: "assistant",
            content: chunk.contentBlockDelta.delta.text,
          };
        }
      }
    }
  }

  private _generateConverseInput(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): any {
    const convertedMessages = this._convertMessages(messages);

    return {
      modelId: options.model,
      messages: convertedMessages,
      system: this.systemMessage ? [{ text: this.systemMessage }] : undefined,
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

  private _convertMessages(messages: ChatMessage[]): any[] {
    return messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: this._convertMessageContent(message.content),
      }));
  }

  private _convertMessageContent(messageContent: MessageContent): any[] {
    if (typeof messageContent === "string") {
      return [{ text: messageContent }];
    }
    return messageContent
      .map((part) => {
        if (part.type === "text") {
          return { text: part.text };
        }
        if (part.type === "imageUrl" && part.imageUrl) {
          return {
            image: {
              format: "jpeg",
              source: {
                bytes: Buffer.from(part.imageUrl.url.split(",")[1], "base64"),
              },
            },
          };
        }
        return null;
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
    } catch (error) {
      console.error("Error in BedrockReranker.rerank:", error);
      throw error;
    }
  }
}

export default Bedrock;
