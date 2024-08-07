import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessageContent,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";

class Bedrock extends BaseLLM {
  private static PROFILE_NAME: string = "bedrock";
  static providerName: ModelProvider = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    contextLength: 200_000,
  };

  constructor(options: LLMOptions) {
    super(options);
    if (!options.apiBase) {
      this.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, options)) {
      yield stripImages(update.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    const input = this._generateConverseInput(messages, options);
    const command = new ConverseStreamCommand(input);
    const response = await client.send(command);

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
        stopSequences: options.stop?.filter((stop) => stop.trim() !== ""),
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
        profile: Bedrock.PROFILE_NAME,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${Bedrock.PROFILE_NAME} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }
}

export default Bedrock;
