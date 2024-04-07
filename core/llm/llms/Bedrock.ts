import * as fs from "fs";
import { join as joinPath } from "path";
import { promisify } from "util";
import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
import { stripImages } from "../countTokens";

const aws4 = require("aws4");
const readFile = promisify(fs.readFile);

namespace BedrockCommon {
  export enum Method {
    Chat = "invoke",
    Completion = "invoke-with-response-stream",
  }
  export const Service: string = "bedrock";
  export const AuthAlgo: string = "AWS4-HMAC-SHA256";
  export const HashAlgo: string = "sha256";
}

class Bedrock extends BaseLLM {
  static providerName: ModelProvider = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "claude-3-sonnet-20240229",
    contextLength: 200_000,
  };

  constructor(options: LLMOptions) {
    super(options);
    this.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
  }

  private _convertModelName(model: string): string {
    return (
      {
        "claude-3-sonnet-20240229": "anthropic.claude-3-sonnet-20240229-v1:0",
        "claude-3-haiku-20240307": "anthropic.claude-3-haiku-20240307-v1:0",
        "claude-2": "anthropic.claude-v2:1",
      }[model] ?? model
    );
  }

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 4096,
      stop_sequences: options.stop,
    };

    return finalOptions;
  }

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = msgs
      .filter((m) => m.role !== "system")
      .map((message) => {
        if (typeof message.content === "string") {
          return message;
        } else {
          return {
            ...message,
            content: message.content.map((part) => {
              if (part.type === "text") {
                return part;
              } else {
                return {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: part.imageUrl?.url.split(",")[1],
                  },
                };
              }
            }),
          };
        }
      });
    return messages;
  }

  private _parseCredentialsFile(fileContents: string) {
    const profiles: { [key: string]: any } = {};
    const lines = fileContents.trim().split("\n");

    let currentProfile: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        currentProfile = trimmedLine.slice(1, -1);
        profiles[currentProfile] = {};
      } else if (currentProfile !== null && trimmedLine.includes("=")) {
        const [key, value] = trimmedLine.split("=");
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        if (trimmedKey === "aws_access_key_id") {
          profiles[currentProfile].accessKeyId = trimmedValue;
        } else if (trimmedKey === "aws_secret_access_key") {
          profiles[currentProfile].secretAccessKey = trimmedValue;
        } else if (trimmedKey === "aws_session_token") {
          profiles[currentProfile].sessionToken = trimmedValue;
        }
      }
    }

    return profiles;
  }

  private async _fetchWithAwsAuthSigV4(
    apiMethod: BedrockCommon.Method,
    body: string,
    model: string,
  ): Promise<Response> {
    const path = `/model/${model}/${apiMethod}`;
    const opts = {
      headers: {
        accept:
          apiMethod === BedrockCommon.Method.Chat
            ? "application/json"
            : "application/vnd.amazon.eventstream",
        "content-type": "application/json",
        "x-amzn-bedrock-accept": "*/*",
      },
      path: path,
      body: body,
      service: "bedrock",
      host: new URL(this.apiBase!).host,
      region: this.region,
    };

    let accessKeyId: string, secretAccessKey: string, sessionToken: string;

    try {
      const data = await readFile(
        joinPath(process.env.HOME!, ".aws", "credentials"),
        "utf8",
      );
      const credentials = this._parseCredentialsFile(data);
      accessKeyId = credentials.bedrock.accessKeyId;
      secretAccessKey = credentials.bedrock.secretAccessKey;
      sessionToken = credentials.bedrock.sessionToken || "";
    } catch (err) {
      console.error("Error reading AWS credentials", err);
      return new Response("403");
    }
    return await this.fetch(new URL(`${this.apiBase}${path}`), {
      method: "POST",
      headers: aws4.sign(opts, { accessKeyId, secretAccessKey, sessionToken })[
        "headers"
      ],
      body: body,
    });
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, options)) {
      yield stripImages(update.content);
    }
    // TODO: Couldn't seem to get this stream API working yet. Deferring to _streamChat.
    // import { streamSse } from "../stream";
    // const response = await this._fetchWithAwsAuthSigV4(BedrockCommon.Method.Completion, JSON.stringify({
    //     ...this._convertArgs(options),
    //     max_tokens: undefined, // Delete this key in favor of the correct one for the Completions API.
    //     max_tokens_to_sample: options.maxTokens,
    //     prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
    //   })
    // );
    // for await (const value of streamSse(response)) {
    //   if (value.completion) {
    //     yield value.completion
    //   }
    // }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const response = await this._fetchWithAwsAuthSigV4(
      BedrockCommon.Method.Chat,
      JSON.stringify({
        ...this._convertArgs(options),
        messages: this._convertMessages(messages),
        anthropic_version: "bedrock-2023-05-31", // Fixed, required parameter for Chat API.
      }),
      this._convertModelName(options.model),
    );
    yield {
      role: "assistant",
      content: (await response.json()).content[0].text,
    };
  }
}

export default Bedrock;
