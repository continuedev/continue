import { streamResponse } from "@continuedev/fetch";
import { v4 as uuidv4 } from "uuid";
import {
  AssistantChatMessage,
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
  TextMessagePart,
  ToolCallDelta,
} from "../../index.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { extractBase64FromDataUrl } from "../../util/url.js";
import { BaseLLM } from "../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";
import {
  GeminiChatContent,
  GeminiChatContentPart,
  GeminiChatRequestBody,
  GeminiChatResponse,
  GeminiGenerationConfig,
  GeminiToolFunctionDeclaration,
  convertContinueToolToGeminiFunction,
} from "./gemini-types";

interface GeminiToolCallDelta extends ToolCallDelta {
  extra_content?: {
    google?: {
      thought_signature?: string;
    };
  };
}

class Gemini extends BaseLLM {
  static providerName = "gemini";

  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-pro",
    apiBase: "https://generativelanguage.googleapis.com/v1beta/",
    maxStopWords: 5,
    maxEmbeddingBatchSize: 100,
  };

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "chat",
    "embed",
    "list",
    "rerank",
    "streamChat",
    "streamFim",
  ];

  // Function to convert completion options to Gemini format
  public convertArgs(options: CompletionOptions): GeminiGenerationConfig {
    // should be public for use within VertexAI
    const finalOptions: any = {}; // Initialize an empty object

    // Map known options
    if (options.topK) {
      finalOptions.topK = options.topK;
    }
    if (options.topP) {
      finalOptions.topP = options.topP;
    }
    if (options.temperature !== undefined && options.temperature !== null) {
      finalOptions.temperature = options.temperature;
    }
    if (options.maxTokens) {
      finalOptions.maxOutputTokens = options.maxTokens;
    }
    if (options.stop) {
      finalOptions.stopSequences = options.stop
        .filter((x) => x.trim() !== "")
        .slice(0, this.maxStopWords ?? Gemini.defaultOptions.maxStopWords);
    }

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      signal,
      options,
    )) {
      yield renderChatMessage(message);
    }
  }

  /**
   * Removes the system message and merges it with the next user message if present.
   * @param messages Array of chat messages
   * @returns Modified array with system message merged into user message if applicable
   */
  public removeSystemMessage(messages: ChatMessage[]): ChatMessage[] {
    // If no messages or first message isn't system, return copy of original messages
    if (messages.length === 0 || messages[0]?.role !== "system") {
      return [...messages];
    }

    // Extract system message
    const systemMessage: ChatMessage = messages[0];

    // Extract system content based on its type
    let systemContent = "";

    if (typeof systemMessage.content === "string") {
      systemContent = systemMessage.content;
    } else if (Array.isArray(systemMessage.content)) {
      const contentArray: Array<MessagePart> =
        systemMessage.content as Array<MessagePart>;

      const concatenatedText = contentArray
        .filter((part): part is TextMessagePart => part.type === "text")
        .map((part) => part.text)
        .join(" ");

      systemContent = concatenatedText ? concatenatedText : "";
    } else if (
      systemMessage.content &&
      typeof systemMessage.content === "object"
    ) {
      const typedContent = systemMessage.content as TextMessagePart;
      systemContent = typedContent?.text || "";
    }

    // Create new array without the system message
    const remainingMessages: ChatMessage[] = messages.slice(1);

    // Check if there's a user message to merge with
    if (remainingMessages.length > 0 && remainingMessages[0].role === "user") {
      const userMessage: ChatMessage = remainingMessages[0];
      const prefix = `System message - follow these instructions in every response: ${systemContent}\n\n---\n\n`;

      // Merge based on user content type
      if (typeof userMessage.content === "string") {
        userMessage.content = prefix + userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        const contentArray: Array<MessagePart> =
          userMessage.content as Array<MessagePart>;
        const textPart = contentArray.find((part) => part.type === "text") as
          | TextMessagePart
          | undefined;

        if (textPart) {
          textPart.text = prefix + textPart.text;
        } else {
          userMessage.content.push({
            type: "text",
            text: prefix,
          } as TextMessagePart);
        }
      } else if (
        userMessage.content &&
        typeof userMessage.content === "object"
      ) {
        const typedContent = userMessage.content as TextMessagePart;
        userMessage.content = [
          {
            type: "text",
            text: prefix + (typedContent.text || ""),
          } as TextMessagePart,
        ];
      }
    }

    return remainingMessages;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const isV1API = this.apiBase?.includes("/v1/");

    const convertedMsgs = isV1API
      ? this.removeSystemMessage(messages)
      : messages;

    if (options.model.includes("bison")) {
      for await (const message of this.streamChatBison(
        convertedMsgs,
        signal,
        options,
      )) {
        yield message;
      }
    } else {
      for await (const message of this.streamChatGemini(
        convertedMsgs,
        signal,
        options,
      )) {
        yield message;
      }
    }
  }

  continuePartToGeminiPart(part: MessagePart): GeminiChatContentPart {
    if (part.type === "text") {
      return {
        text: part.text,
      };
    }

    let data = "";
    if (part.imageUrl?.url) {
      const extracted = extractBase64FromDataUrl(part.imageUrl.url);
      if (extracted) {
        data = extracted;
      } else {
        console.warn(
          "Gemini: skipping image with invalid data URL format",
          part.imageUrl.url,
        );
      }
    }

    return {
      inlineData: {
        mimeType: "image/jpeg",
        data,
      },
    };
  }

  public prepareBody(
    messages: ChatMessage[],
    options: CompletionOptions,
    isV1API: boolean,
    includeToolIds: boolean,
  ): GeminiChatRequestBody {
    const toolCallIdToNameMap = new Map<string, string>();
    messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        msg.toolCalls.forEach((call) => {
          if (call.id && call.function?.name) {
            toolCallIdToNameMap.set(call.id, call.function.name);
          }
        });
      }
    });
    const systemMessage = messages.find(
      (msg) => msg.role === "system",
    )?.content;

    const body: GeminiChatRequestBody = {
      contents: messages
        .filter((msg) => !(msg.role === "system" && isV1API))
        .map((msg) => {
          if (msg.role === "tool") {
            let functionName = toolCallIdToNameMap.get(msg.toolCallId);
            if (!functionName) {
              console.warn(
                "Sending tool call response for unidentified tool call",
              );
            }
            return {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    id: includeToolIds ? msg.toolCallId : undefined,
                    name: functionName || "unknown",
                    response: {
                      output: msg.content, // "output" key is opinionated - not all functions will output objects
                    },
                  },
                },
              ],
            };
          }
          if (msg.role === "assistant") {
            const assistantMsg: GeminiChatContent = {
              role: "model",
              parts:
                typeof msg.content === "string"
                  ? [{ text: msg.content }]
                  : msg.content.map(this.continuePartToGeminiPart),
            };

            if (msg.toolCalls && msg.toolCalls.length) {
              (msg.toolCalls as GeminiToolCallDelta[]).forEach(
                (toolCall, index) => {
                  if (toolCall.function?.name) {
                    const signatureForCall =
                      toolCall?.extra_content?.google?.thought_signature;

                    let thoughtSignature: string | undefined;
                    if (index === 0) {
                      if (typeof signatureForCall === "string") {
                        thoughtSignature = signatureForCall;
                      } else {
                        // Fallback per https://ai.google.dev/gemini-api/docs/thought-signatures
                        // for histories that were not generated by Gemini or are missing signatures.
                        thoughtSignature = "skip_thought_signature_validator";
                      }
                    }

                    assistantMsg.parts.push({
                      functionCall: {
                        name: toolCall.function.name,
                        args: safeParseToolCallArgs(toolCall),
                      },
                      ...(thoughtSignature && { thoughtSignature }),
                    });
                  }
                },
              );
            }

            return assistantMsg;
          }
          return {
            role: "user",
            parts:
              typeof msg.content === "string"
                ? [{ text: msg.content }]
                : msg.content.map(this.continuePartToGeminiPart),
          };
        }),
    };
    if (options) {
      body.generationConfig = this.convertArgs(options);
    }

    // https://ai.google.dev/gemini-api/docs/api-versions
    if (!isV1API) {
      if (systemMessage) {
        body.systemInstruction = {
          parts: [{ text: stripImages(systemMessage) }],
        };
      }
      // Convert and add tools if present
      if (options.tools?.length) {
        // Choosing to map all tools to the functionDeclarations of one tool
        // Rather than map each tool to its own tool + functionDeclaration
        // Same difference
        const functions: GeminiToolFunctionDeclaration[] = [];
        options.tools.forEach((tool) => {
          try {
            functions.push(convertContinueToolToGeminiFunction(tool));
          } catch (e) {
            console.warn(
              `Failed to convert tool to gemini function definition. Skipping: ${JSON.stringify(tool, null, 2)}`,
            );
          }
        });
        if (functions.length) {
          body.tools = [
            {
              functionDeclarations: functions,
            },
          ];
        }
      }
    }
    return body;
  }

  public async *processGeminiResponse(
    stream: AsyncIterable<string>,
  ): AsyncGenerator<ChatMessage> {
    let buffer = "";
    for await (const chunk of stream) {
      buffer += chunk;
      if (buffer.startsWith("[")) {
        buffer = buffer.slice(1);
      }
      if (buffer.endsWith("]")) {
        buffer = buffer.slice(0, -1);
      }
      if (buffer.startsWith(",")) {
        buffer = buffer.slice(1);
      }

      const parts = buffer.split("\n,");

      let foundIncomplete = false;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let data: GeminiChatResponse;
        try {
          data = JSON.parse(part) as GeminiChatResponse;
        } catch (e) {
          foundIncomplete = true;
          continue; // yo!
        }

        if ("error" in data) {
          throw new Error(data.error.message);
        }

        // In case of max tokens reached, gemini will sometimes return content with no parts, even though that doesn't match the API spec
        const contentParts = data?.candidates?.[0]?.content?.parts;
        if (contentParts) {
          const textParts: MessagePart[] = [];
          const toolCalls: ToolCallDelta[] = [];

          for (const part of contentParts) {
            if ("text" in part) {
              textParts.push({ type: "text", text: part.text });
            } else if ("functionCall" in part) {
              const thoughtSignature = part.thoughtSignature;
              toolCalls.push({
                type: "function",
                id: part.functionCall.id ?? uuidv4(),
                function: {
                  name: part.functionCall.name,
                  arguments:
                    typeof part.functionCall.args === "string"
                      ? part.functionCall.args
                      : JSON.stringify(part.functionCall.args),
                },
                ...(thoughtSignature && {
                  extra_content: {
                    google: {
                      thought_signature: thoughtSignature,
                    },
                  },
                }),
              });
            } else {
              // Note: function responses shouldn't be streamed, images not supported
              console.warn("Unsupported gemini part type received", part);
            }
          }

          const assistantMessage: AssistantChatMessage = {
            role: "assistant",
            content: textParts.length ? textParts : "",
          };
          if (toolCalls.length > 0) {
            assistantMessage.toolCalls = toolCalls;
          }
          if (textParts.length || toolCalls.length) {
            yield assistantMessage;
          }
        } else {
          // Handle the case where the expected data structure is not found
          console.warn("Unexpected response format:", data);
        }
      }
      if (foundIncomplete) {
        buffer = parts[parts.length - 1];
      } else {
        buffer = "";
      }
    }
  }

  private async *streamChatGemini(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiURL = new URL(
      `models/${options.model}:streamGenerateContent?key=${this.apiKey}`,
      this.apiBase,
    );

    const isV1API = !!this.apiBase?.includes("/v1/");

    // Convert chat messages to contents
    const body = this.prepareBody(messages, options, isV1API, true);

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    for await (const message of this.processGeminiResponse(
      streamResponse(response),
    )) {
      yield message;
    }
  }
  private async *streamChatBison(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const msgList = [];
    for (const message of messages) {
      msgList.push({ content: message.content });
    }

    const apiURL = new URL(
      `models/${options.model}:generateMessage?key=${this.apiKey}`,
      this.apiBase,
    );
    const body = { prompt: { messages: msgList } };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 499) {
      return; // Aborted by user
    }
    const data = await response.json();
    yield { role: "assistant", content: data.candidates[0].content };
  }

  async _embed(batch: string[]): Promise<number[][]> {
    // Batch embed endpoint: https://ai.google.dev/api/embeddings?authuser=1#EmbedContentRequest
    const requests = batch.map((text) => ({
      model: this.model,
      content: {
        role: "user",
        parts: [{ text }],
      },
    }));

    const resp = await this.fetch(
      new URL(`${this.model}:batchEmbedContents`, this.apiBase),
      {
        method: "POST",
        body: JSON.stringify({
          requests,
        }),
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        } as any,
      },
    );

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;

    return data.embeddings.map((embedding: any) => embedding.values);
  }
}

export default Gemini;
