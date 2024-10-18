import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { streamResponse } from "../stream.js";
import VertexAI from "./VertexAI.js";

class GeminiVertexAI extends VertexAI {
  static providerName: ModelProvider = "gemini-vertexai";

  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-pro",
    region: "us-central1",
  };

  // Function to convert completion options to Gemini format
  private _convertArgs(options: CompletionOptions) {
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

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const isV1API = this.apiBase.includes("/v1/");

    // Conditionally apply removeSystemMessage
    const convertedMsgs = isV1API
      ? this.removeSystemMessage(messages)
      : messages;

    if (options.model.includes("gemini")) {
      yield* this.streamChatGemini(convertedMsgs, options);
    } else {
      yield* this.streamChatBison(convertedMsgs, options);
    }
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
      ...this._convertArgs(options),
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
}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export default GeminiVertexAI;
