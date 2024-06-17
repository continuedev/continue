import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessageContent,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../countTokens.js";
import { BaseLLM } from "../index.js";

class Bedrock extends BaseLLM {
  private static PROFILE_NAME: string = "bedrock";
  static providerName: ModelProvider = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "claude-3-sonnet-20240229",
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
    const toolkit = this._getToolkit(options.model);
    const command = toolkit.generateCommand(messages, options);
    const response = await client.send(command);
    if (response.body) {
      for await (const value of response.body) {
        const text = toolkit.unwrapResponseChunk(value);
        if (text) {
          yield { role: "assistant", content: text };
        }
      }
    }
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

  private _getToolkit(model: string): BedrockModelToolkit {
    if (model.includes("claude-3")) {
      return new AnthropicClaude3Toolkit(this);
    } else if (model.includes("llama")) {
      return new Llama3Toolkit(this);
    } else {
      throw new Error(`Model ${model} is currently not supported in Continue for Bedrock`);
    }
  }
}

interface BedrockModelToolkit {
  generateCommand(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): InvokeModelWithResponseStreamCommand;
  unwrapResponseChunk(rawValue: any): string;
}

class AnthropicClaude3Toolkit implements BedrockModelToolkit {
  constructor(private bedrock: Bedrock) {}
  generateCommand(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): InvokeModelWithResponseStreamCommand {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens,
      system: this.bedrock.systemMessage,
      messages: this._convertMessages(messages),
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      stop_sequences: options.stop,
    };
    return new InvokeModelWithResponseStreamCommand({
      body: new TextEncoder().encode(JSON.stringify(payload)),
      contentType: "application/json",
      modelId: options.model,
    });
  }

  private _convertMessages(msgs: ChatMessage[]): any[] {
    return msgs
      .filter((m) => m.role !== "system")
      .map((message) => this._convertMessage(message));
  }

  private _convertMessage(message: ChatMessage): any {
    return {
      role: message.role,
      content: this._convertMessageContent(message.content),
    };
  }

  private _convertMessageContent(messageContent: MessageContent): any {
    if (typeof messageContent === "string") {
      return messageContent;
    }
    return messageContent.map((part) => {
      if (part.type === "text") {
        return part;
      }
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: part.imageUrl?.url.split(",")[1],
        },
      };
    });
  }
  unwrapResponseChunk(rawValue: any): string {
    const binaryChunk = rawValue.chunk?.bytes;
    const textChunk = new TextDecoder().decode(binaryChunk);
    const chunk = JSON.parse(textChunk).delta?.text;
    return chunk;
  }
}

class Llama3Toolkit implements BedrockModelToolkit {
  constructor(private bedrock: Bedrock) {}
  generateCommand(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): InvokeModelWithResponseStreamCommand {
    let prompt = "<|begin_of_text|>";
    if (this.bedrock.systemMessage) {
      prompt += `<|start_header_id|>system<|end_header_id|>${this.bedrock.systemMessage}<|eot_id|>`;
    }
    for (const message of messages) {
      let content = "";
      if (typeof message.content === "string") {
        content = message.content;
      } else {
        for (const part of message.content) {
          if (part.type === "text") {
            content += part.text || "";
          } else {
            console.warn("Skipping non-text message part", part);
          }
        }
      }
      if (content) {
        prompt += `<|start_header_id|>${message.role}<|end_header_id|>${content}<|eot_id|>`;
      }
    }
    prompt += "<|start_header_id|>assistant<|end_header_id|>";

    const payload = {
      prompt,
      max_gen_len: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
    };

    return new InvokeModelWithResponseStreamCommand({
      body: new TextEncoder().encode(JSON.stringify(payload)),
      contentType: "application/json",
      modelId: options.model,
    });
  }
  unwrapResponseChunk(rawValue: any): string {
    const binaryChunk = rawValue.chunk?.bytes;
    const textChunk = new TextDecoder().decode(binaryChunk);
    const chunk = JSON.parse(textChunk).generation;
    return chunk;
  }
}

export default Bedrock;
