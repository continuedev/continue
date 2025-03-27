import {
  AssistantChatMessage,
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
  TextMessagePart,
  ToolCallDelta,
} from "../../index.js";
import { findLast } from "../../util/findLast.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";
import {
  GeminiChatContentPart,
  GeminiChatRequestBody,
  GeminiChatResponse,
  GeminiGenerationConfig,
  GeminiToolFunctionDeclaration,
} from "./gemini-types.js";

class Gemini extends BaseLLM {
  static providerName = "gemini";

  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-pro",
    apiBase: "https://generativelanguage.googleapis.com/v1beta/",
    maxStopWords: 5,
    maxEmbeddingBatchSize: 100,
  };

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
  const systemMessage : ChatMessage = messages[0];
  
  // Extract system content based on its type
  let systemContent = "";
  if (typeof systemMessage.content === "string") {
    systemContent = systemMessage.content;
  } else if (Array.isArray(systemMessage.content)) {
    const contentArray : Array<MessagePart> = systemMessage.content as Array<MessagePart>;
    const concatenatedText = contentArray
      .filter(part => part.type === "text")
      .map(part => part.text)
      .join(" ");
    systemContent = concatenatedText ? concatenatedText : "";
  } else if (systemMessage.content && typeof systemMessage.content === "object") {
    const typedContent = systemMessage.content as TextMessagePart;
    systemContent = typedContent?.text || "";
  }
  
  // Create new array without the system message
  const remainingMessages : ChatMessage[] = messages.slice(1);
  
  // Check if there's a user message to merge with
  if (remainingMessages.length > 0 && remainingMessages[0].role === "user") {
    const userMessage : ChatMessage = remainingMessages[0];
    const prefix = `System message - follow these instructions in every response: ${systemContent}\n\n---\n\n`;
    
    // Merge based on user content type
    if (typeof userMessage.content === "string") {
      userMessage.content = prefix + userMessage.content;
    } else if (Array.isArray(userMessage.content)) {
      const contentArray : Array<MessagePart> = userMessage.content as Array<MessagePart>;
      const textPart = contentArray.find(part => part.type === "text") as TextMessagePart | undefined;
      
      if (textPart) {
        textPart.text = prefix + textPart.text;
      } else {
        userMessage.content.push({
          type: "text",
          text: prefix
        } as TextMessagePart);
      }
    } else if (userMessage.content && typeof userMessage.content === "object") {
      const typedContent = userMessage.content as TextMessagePart;
      userMessage.content = [{
        type: "text",
        text: prefix + (typedContent.text || "")
      } as TextMessagePart];
    }
  }
  
  return remainingMessages;
}


  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // Ensure this.apiBase is used if available, otherwise use default
    const apiBase =
      this.apiBase ||
      Gemini.defaultOptions?.apiBase ||
      "https://generativelanguage.googleapis.com/v1beta/"; // Determine if it's a v1 API call based on apiBase
    const isV1API = apiBase.includes("/v1/");

    // Conditionally apply removeSystemMessage
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
    return part.type === "text"
      ? {
          text: part.text,
        }
      : {
          inlineData: {
            mimeType: "image/jpeg",
            data: part.imageUrl?.url.split(",")[1],
          },
        };
  }

  public prepareBody(
    messages: ChatMessage[],
    options: CompletionOptions,
    isV1API: boolean,
  ): GeminiChatRequestBody {
    const body: GeminiChatRequestBody = {
      contents: messages
        .filter((msg) => !(msg.role === "system" && isV1API))
        .map((msg) => {
          if (msg.role === "tool") {
            let fn_name = "";
            const lastToolCallMessage = findLast(
              messages,
              (msg) => "toolCalls" in msg && msg.toolCalls?.[0]?.function?.name,
            ) as AssistantChatMessage;
            if (lastToolCallMessage) {
              fn_name = lastToolCallMessage.toolCalls![0]!.function!.name!;
            }
            if (!fn_name) {
              console.warn(
                "Sending tool call response for unidentified tool call",
              );
            }
            return {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: fn_name || "unknown",
                    response: {
                      output: msg.content, // "output" key is opinionated - not all functions will output objects
                    },
                  },
                },
              ],
            };
          }
          const assistantMsg = {
            role:
              msg.role === "assistant" ? ("model" as const) : ("user" as const),
            parts:
              typeof msg.content === "string"
                ? [{ text: msg.content }]
                : msg.content.map(this.continuePartToGeminiPart),
          };
          if (msg.role === "assistant" && msg.toolCalls) {
            msg.toolCalls.forEach((toolCall) => {
              if (toolCall.function?.name && toolCall.function?.arguments) {
                assistantMsg.parts.push({
                  functionCall: {
                    name: toolCall.function.name,
                    args: JSON.parse(toolCall.function.arguments),
                  },
                });
              }
            });
          }

          return assistantMsg;
        }),
    };
    if (options) {
      body.generationConfig = this.convertArgs(options);
    }

    // https://ai.google.dev/gemini-api/docs/api-versions
    if (!isV1API) {
      if (this.systemMessage) {
        body.systemInstruction = { parts: [{ text: this.systemMessage }] };
      }
      // Convert and add tools if present
      if (options.tools?.length) {
        // Choosing to map all tools to the functionDeclarations of one tool
        // Rather than map each tool to its own tool + functionDeclaration
        // Same difference
        const functions: GeminiToolFunctionDeclaration[] = [];
        options.tools.forEach((tool) => {
          if (tool.function.description && tool.function.name) {
            const fn: GeminiToolFunctionDeclaration = {
              description: tool.function.description,
              name: tool.function.name,
            };

            if (
              tool.function.parameters &&
              "type" in tool.function.parameters
              // && typeof tool.function.parameters.type === "string"
            ) {
              // const paramType =  "TYPE_UNSPECIFIED"
              // | "STRING"
              // | "NUMBER"
              // | "INTEGER"
              // | "BOOLEAN"
              // | "ARRAY"
              // | "OBJECT"

              if (tool.function.parameters.type === "object") {
                // Gemini can't take an empty object
                // So if empty object param is present just don't add parameters
                if (
                  JSON.stringify(tool.function.parameters.properties) === "{}"
                ) {
                  functions.push(fn);
                  return;
                }
              }
              // Helper function to recursively clean JSON Schema objects
              const cleanJsonSchema = (schema: any): any => {
                if (!schema || typeof schema !== "object") return schema;

                if (Array.isArray(schema)) {
                  return schema.map(cleanJsonSchema);
                }

                const {
                  $schema,
                  additionalProperties,
                  default: defaultValue,
                  ...rest
                } = schema;

                // Recursively clean nested properties
                if (rest.properties) {
                  rest.properties = Object.entries(rest.properties).reduce(
                    (acc, [key, value]) => ({
                      ...acc,
                      [key]: cleanJsonSchema(value),
                    }),
                    {},
                  );
                }

                // Clean items in arrays
                if (rest.items) {
                  rest.items = cleanJsonSchema(rest.items);
                }

                return rest;
              };

              // Clean the parameters and convert type to uppercase
              const cleanedParams = cleanJsonSchema(tool.function.parameters);
              fn.parameters = {
                ...cleanedParams,
                type: tool.function.parameters.type.toUpperCase(),
              };
            }
            functions.push(fn);
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

        // Check for existence of each level before accessing the final 'text' property
        const content = data?.candidates?.[0]?.content;
        if (content) {
          const supportedParts: MessagePart[] = [];
          const toolCalls: ToolCallDelta[] = [];

          // Process all parts first to maintain order
          const processedParts: Array<{
            type: "content" | "tool" | "toolCall";
            data: any;
          }> = [];

          for (const part of content.parts) {
            if ("text" in part) {
              supportedParts.push({ type: "text", text: part.text });
            } else if ("inlineData" in part) {
              supportedParts.push({
                type: "imageUrl",
                imageUrl: {
                  url: `data:image/jpeg;base64,${part.inlineData.data}`,
                },
              });
            } else if ("functionCall" in part) {
              // Queue function call
              processedParts.push({
                type: "toolCall",
                data: {
                  type: "function",
                  id: "", // Not supported by gemini
                  function: {
                    name: part.functionCall.name,
                    arguments:
                      typeof part.functionCall.args === "string"
                        ? part.functionCall.args
                        : JSON.stringify(part.functionCall.args),
                  },
                },
              });
            } else if ("functionResponse" in part) {
              // Queue function response
              processedParts.push({
                type: "tool",
                data: {
                  role: "tool",
                  content: part.functionResponse.response.output as string,
                  toolCallId: part.functionResponse.name,
                },
              });
            } else {
              console.warn("Unsupported gemini part type received", part);
            }
          }

          // If we have supported content parts, yield them first
          if (supportedParts.length) {
            yield {
              role: "assistant",
              content: supportedParts,
            };
          }

          // Then process tool calls and responses in order
          for (const part of processedParts) {
            if (part.type === "toolCall") {
              yield {
                role: "assistant",
                content: "",
                toolCalls: [part.data],
              };
            } else if (part.type === "tool") {
              yield part.data;
            }
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
    // This feels hacky to repeat code from above function but was the quickest
    // way to ensure system message re-formatting isn't done if user has specified v1
    const apiBase = this.apiBase || Gemini.defaultOptions.apiBase!; // Determine if it's a v1 API call based on apiBase
    const isV1API = apiBase.includes("/v1/");

    // Convert chat messages to contents
    const body = this.prepareBody(messages, options, isV1API);

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
