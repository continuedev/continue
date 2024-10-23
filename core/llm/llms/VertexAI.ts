import { GoogleAuth } from "google-auth-library";
import { BaseLLM } from "../index.js";
import { stripImages } from "../images.js";
import { streamSse } from "../stream.js";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
  ModelProvider,
} from "../../index.js";
import { streamResponse } from "../stream.js";

class VertexAI extends BaseLLM {
  static providerName: ModelProvider = "vertexai";
  declare apiBase: string;
  declare vertexProvider: string;

  private clientPromise = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  }).getClient();

  private static getDefaultApiBaseFrom(options: LLMOptions) {
    const { region, projectId } = options;
    if (!region || !projectId) {
      throw new Error(
        "region and projectId must be defined if apiBase is not provided",
      );
    }
    return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/`;
  }

  constructor(_options: LLMOptions) {
    super(_options);
    this.apiBase ??= VertexAI.getDefaultApiBaseFrom(_options);
    this.vertexProvider =
      _options.model.includes("mistral") || _options.model.includes("codestral") || _options.model.includes("mixtral")
        ? "Mistral"
        : _options.model.includes("claude")
          ? "anthropic"
          : _options.model.includes("gemini")
            ? "gemini" :
            "unknown";
  }

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const client = await this.clientPromise;
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error(
        "Could not get an access token. Set up your Google Application Default Credentials.",
      );
    }
    return await super.fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  }

  // Anthropic functions
  private _anthropicConvertArgs(options: CompletionOptions) {
    const finalOptions = {
      anthropic_version: "vertex-2023-10-16",
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 2048,
      stop_sequences: options.stop?.filter((x) => x.trim() !== ""),
      stream: options.stream ?? true,
    };

    return finalOptions;
  }

  private _anthropicConvertMessages(msgs: ChatMessage[]): any[] {
    const filteredmessages = msgs.filter((m) => m.role !== "system")
    const lastTwoUserMsgIndices = filteredmessages
      .map((msg, index) => (msg.role === "user" ? index : -1))
      .filter((index) => index !== -1).slice(-2);

    const messages = filteredmessages.map((message, filteredMsgIdx) => {
      // Add cache_control parameter to the last two user messages
      // The second-to-last because it retrieves potentially already cached contents,
      // The last one because we want it cached for later retrieval.
      // See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
      const addCaching = this.cacheBehavior?.cacheConversation && lastTwoUserMsgIndices.includes(filteredMsgIdx);

      if (typeof message.content === "string") {
        var chatMessage = {
          ...message,
          content: [{
            type: "text",
            text: message.content,
            ...(addCaching ? { cache_control: { type: "ephemeral" } } : {})
          }]
        };
        return chatMessage;
      }

      return {
        ...message,
        content: message.content.map((part, contentIdx) => {
          if (part.type === "text") {
            const newpart = {
              ...part,
              // If multiple text parts, only add cache_control to the last one
              ...((addCaching && contentIdx == message.content.length - 1) ? { cache_control: { type: "ephemeral" } } : {})
            };
            return newpart;
          }
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: part.imageUrl?.url.split(",")[1],
            },
          };
        }),
      };
    });
    return messages;
  }

  protected async *StreamChatAnthropic(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const shouldCacheSystemMessage = !!this.systemMessage && this.cacheBehavior?.cacheSystemMessage;
    const systemMessage: string = stripImages(
      messages.filter((m) => m.role === "system")[0]?.content,
    );
    const apiURL = new URL(
      `publishers/anthropic/models/${options.model}:streamRawPredict`,
      this.apiBase
    );

    const response = await this.fetch(apiURL, {
      method: "POST",
      headers: {
        ...(shouldCacheSystemMessage || this.cacheBehavior?.cacheConversation
          ? { "anthropic-beta": "prompt-caching-2024-07-31" }
          : {}),
      },
      body: JSON.stringify({
        ...this._anthropicConvertArgs(options),
        messages: this._anthropicConvertMessages(messages),
        system: shouldCacheSystemMessage
          ? [
            {
              type: "text",
              text: this.systemMessage,
              cache_control: { type: "ephemeral" },
            },
          ]
          : systemMessage,
      }),
    });

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }

    for await (const value of streamSse(response)) {
      if (value.type == "message_start") console.log(value);
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }
  }


  //Gemini
  // Function to convert completion options to Gemini format
  private _geminiConvertArgs(options: CompletionOptions) {
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
      finalOptions.stopSequences = options.stop.filter((x) => x.trim() !== "");
    }

    return { generationConfig: finalOptions }; // Wrap options under 'generationConfig'
  }


  private removeSystemMessage(messages: ChatMessage[]) {
    const msgs = [...messages];

    if (msgs[0]?.role === "system") {
      const sysMsg = msgs.shift()?.content;
      // @ts-ignore
      if (msgs[0]?.role === "user") {
        msgs[0].content = `System message - follow these instructions in every response: ${sysMsg}\n\n---\n\n${msgs[0].content}`;
      }
    }

    return msgs;
  }


  private _continuePartToGeminiPart(part: MessagePart) {
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

  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiURL = new URL(
      `publishers/google/models/${options.model}:streamGenerateContent`,
      this.apiBase,
    );
    // This feels hacky to repeat code from above function but was the quickest
    // way to ensure system message re-formatting isn't done if user has specified v1
    const isV1API = this.apiBase.includes("/v1/");

    const contents = messages
      .map((msg) => {
        if (msg.role === "system" && !isV1API) {
          return null; // Don't include system message in contents
        }
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts:
            typeof msg.content === "string"
              ? [{ text: msg.content }]
              : msg.content.map(this._continuePartToGeminiPart),
        };
      })
      .filter((c) => c !== null);

    const body = {
      ...this._geminiConvertArgs(options),
      contents,
      // if this.systemMessage is defined, reformat it for Gemini API
      ...(this.systemMessage &&
        !isV1API && {
        systemInstruction: { parts: [{ text: this.systemMessage }] },
      }),
    };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    let buffer = "";
    for await (const chunk of streamResponse(response)) {
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
        let data;
        try {
          data = JSON.parse(part);
        } catch (e) {
          foundIncomplete = true;
          continue; // yo!
        }
        if (data.error) {
          throw new Error(data.error.message);
        }
        // Check for existence of each level before accessing the final 'text' property
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          // Incrementally stream the content to make it smoother
          const content = data.candidates[0].content.parts[0].text;
          const words = content.split(/(\s+)/);
          const delaySeconds = Math.min(4.0 / (words.length + 1), 0.1);
          while (words.length > 0) {
            const wordsToYield = Math.min(3, words.length);
            yield {
              role: "assistant",
              content: words.splice(0, wordsToYield).join(""),
            };
            await delay(delaySeconds);
          }
        } else {
          // Handle the case where the expected data structure is not found
          if (data?.candidates?.[0]?.finishReason !== "STOP") {
            console.warn("Unexpected response format:", data);
          }
        }
      }
      if (foundIncomplete) {
        buffer = parts[parts.length - 1];
      } else {
        buffer = "";
      }
    }
  }

  private async *streamChatBison(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const instances = messages.map((message) => ({ prompt: message.content }));

    const apiURL = new URL(
      `publishers/google/models/${options.model}:predict`,
      this.apiBase,
    );
    const body = {
      instances,
      parameters: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        topK: options.topK,
        stopSequences: options.stop,
        presencePenalty: options.presencePenalty,
        frequencyPenalty: options.frequencyPenalty,
      },
    };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    yield { role: "assistant", content: data.predictions[0].content };
  }

  //Mistral


  protected async *StreamChatMistral(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiBase = this.apiBase!;
    const apiURL = new URL(
      `publishers/mistralai/models/${options.model}:streamRawPredict`,
      apiBase,
    );

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      (lastMessage as any).prefix = true;
    }

    const body = {
      model: options.model,
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens,
      stream: options.stream ?? true,
      stop: options.stop,
      messages,
    };

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for await (const chunk of streamSse(response)) {
      yield chunk.choices[0].delta;
    }
  }

  protected async *StreamFimMistral(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const apiBase = this.apiBase!;
    const apiURL = new URL(
      `publishers/mistralai/models/${options.model}:streamRawPredict`,
      apiBase,
    );

    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      stream: options.stream ?? true,
      stop: options.stop,
      prompt: prefix,
      suffix,
    };

    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for await (const chunk of streamSse(response)) {
      yield chunk.choices[0].delta.content;
    }
  }



  //gecko
  protected async *streamFimGecko(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const endpoint = new URL("publishers/google/models/code-gecko:predict", this.apiBase);
    const resp = await this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        instances: [
          {
            prefix: prefix,
            suffix: suffix
          }
        ],
        parameters: {
          temperature: options.temperature,
          maxOutputTokens: Math.min(options.maxTokens ?? 64, 64),
          stopSequences: options.stop?.splice(0, 5),
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.frequencyPenalty,
        }

      }),
    });
    // Streaming is not supported by code-gecko
    // TODO: convert to non-streaming fim method when one exist in continue.
    yield (await resp.json()).predictions[0].content;
  }

  //Manager functions

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const isV1API = this.apiBase.includes("/v1/");

    // Conditionally apply removeSystemMessage
    const convertedMsgs = isV1API
      ? this.removeSystemMessage(messages)
      : messages;
    if (this.vertexProvider == "gemini") {
      yield* this.streamChatGemini(convertedMsgs, options);
    } else if (this.vertexProvider == "mistral") {
      yield* this.StreamChatMistral(messages, options);
    } else if (this.vertexProvider == "anthropic") {
      yield* this.StreamChatAnthropic(messages, options)
    } else {
      if (options.model.includes("bison")) {
        yield* this.streamChatBison(convertedMsgs, options);
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      options,
    )) {
      yield stripImages(message.content);
    }
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {



    if (this.model === "code-gecko") {
      yield* this.streamFimGecko(prefix, suffix, options);
    } else if (this.model.includes("codestral")) {
      yield* this.StreamFimMistral(prefix, suffix, options);
    } else {
      throw new Error(`Unsupported model: ${this.model}`);
    }


  }

  supportsFim(): boolean {
    return ["code-gecko", "codestral-latest"].includes(this.model);
  }


}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}



export default VertexAI;
