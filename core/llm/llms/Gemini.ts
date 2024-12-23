import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
} from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";

class Gemini extends BaseLLM {
  static providerName = "gemini";

  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-pro",
    apiBase: "https://generativelanguage.googleapis.com/v1beta/",
    maxStopWords: 5,
    maxEmbeddingBatchSize: 100,
  };

  // Function to convert completion options to Gemini format
  public convertArgs(options: CompletionOptions) {
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

    return { generationConfig: finalOptions }; // Wrap options under 'generationConfig'
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

  public removeSystemMessage(messages: ChatMessage[]) {
    // should be public for use within VertexAI
    const msgs = [...messages];

    if (msgs[0]?.role === "system") {
      const sysMsg = msgs.shift()?.content;
      // @ts-ignore
      if (msgs[0]?.role === "user") {
        // @ts-ignore
        msgs[0].content = `System message - follow these instructions in every response: ${sysMsg}\n\n---\n\n${msgs[0].content}`;
      }
    }

    return msgs;
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

    if (options.model.includes("gemini")) {
      for await (const message of this.streamChatGemini(
        convertedMsgs,
        signal,
        options,
      )) {
        yield message;
      }
    } else {
      for await (const message of this.streamChatBison(
        convertedMsgs,
        signal,
        options,
      )) {
        yield message;
      }
    }
  }

  continuePartToGeminiPart(part: MessagePart) {
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
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiURL = new URL(
      `models/${options.model}:streamGenerateContent?key=${this.apiKey}`,
      this.apiBase,
    );
    // This feels hacky to repeat code from above function but was the quickest
    // way to ensure system message re-formatting isn't done if user has specified v1
    const apiBase =
      this.apiBase ||
      Gemini.defaultOptions?.apiBase ||
      "https://generativelanguage.googleapis.com/v1beta/"; // Determine if it's a v1 API call based on apiBase
    const isV1API = apiBase.includes("/v1/");

    const contents = messages
      .map((msg) => {
        if (msg.role === "system" && !isV1API) {
          return null; // Don't include system message in contents
        }
        if (msg.role === "tool") {
          return null;
        }
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts:
            typeof msg.content === "string"
              ? [{ text: msg.content }]
              : msg.content.map(this.continuePartToGeminiPart),
        };
      })
      .filter((c) => c !== null);

    const body = {
      ...this.convertArgs(options),
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
      signal,
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
          yield {
            role: "assistant",
            content,
          };
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
