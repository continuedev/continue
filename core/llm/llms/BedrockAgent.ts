import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  type InvokeAgentCommandInput,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

import {
  ChatMessage,
  CompletionOptions as BaseCompletionOptions,
  LLMOptions,
  MessageContent,
} from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

interface CompletionOptions extends BaseCompletionOptions {
  agentId: string;
  agentAliasId: string;
  sessionId?: string;
  enableTrace?: boolean;
}

class BedrockAgent extends BaseLLM {
  static providerName = "bedrockagent";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    contextLength: 4096,
    profile: "bedrock",
    completionOptions: {
      maxTokens: 2096,
      model: "",
    }
  };

  constructor(options: LLMOptions) {
    super(options);
    if (!options.apiBase) {
      this.apiBase = `https://bedrock-agent-runtime.${options.region}.amazonaws.com`;
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

    const client = new BedrockAgentRuntimeClient({
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

    client.middlewareStack.add(
      (next: any) => async (args: any) => {
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

    const input = this._generateAgentInput(messages, options);
    const command = new InvokeAgentCommand(input);
    const response = await client.send(command, { abortSignal: signal });

    // Process the response
    if (response.completion) {
      let fullContent = "";
      for await (const chunk of response.completion) {
        // Accumulate the chunks
        if (chunk) {
          fullContent += new TextDecoder().decode(chunk.chunk?.bytes);
        }
      }
      // Check if fullContent already contains a code block
      const content = fullContent.includes("```")
        ? fullContent
        : "```" + fullContent + "```";
      yield {
        role: "assistant",
        content,
      };
    }

    // Handle any additional metadata from the response
    if (response.$metadata) {
      const metadata = response.$metadata;
      if (metadata.httpStatusCode === 200) {
        // Optional: Log successful interaction
        console.debug("Agent interaction successful");
      }
    }
  }

  private _generateAgentInput(
    messages: ChatMessage[],
    options: Partial<CompletionOptions>,
  ): InvokeAgentCommandInput {
    // Combine all messages into a single input for the agent
    const inputText = messages
      .map((msg) => this._convertMessageContent(msg.content))
      .join("\n");

    // Use configured values from options if not provided in completion options
    const agentId = this.agentId;
    const agentAliasId = this.agentAliasId;

    if (!agentId || !agentAliasId) {
      throw new Error(
        "agentId and agentAliasId are required for Bedrock Agent. Configure them in the config file or provide them in the completion options.",
      );
    }

    return {
      agentId,
      agentAliasId,
      sessionId: options.sessionId || Date.now().toString(),
      inputText, // Use inputText directly as per AWS SDK
      enableTrace: options.enableTrace || false,
    };
  }

  private _convertMessageContent(messageContent: MessageContent): string {
    if (typeof messageContent === "string") {
      return messageContent;
    }
    return messageContent
      .map((part) => {
        if (part.type === "text") {
          return part.text;
        }
        // Agents currently don't support image inputs
        return "";
      })
      .join("");
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

  // Agents don't support embeddings
  async embed(chunks: string[]): Promise<number[][]> {
    throw new Error("Embedding is not supported for Bedrock Agents");
  }

  // Agents don't support reranking
  async rerank(query: string, chunks: any[]): Promise<number[]> {
    throw new Error("Reranking is not supported for Bedrock Agents");
  }
}

export default BedrockAgent;
