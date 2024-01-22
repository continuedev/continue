import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
import { stripImages } from "../countTokens";

class Gemini extends BaseLLM {
  static providerName: ModelProvider = "gemini";

  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-pro",
    region: "us-central1",
  };

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options
    )) {
      yield stripImages(chunk.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const apiUrl = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/gemini-pro:streamGenerateContent`;
    const body = {
      contents: messages.map((msg) => {
        return {
          role: msg.role === "assistant" ? "ASSISTANT" : "USER",
          parts: [{ text: msg.content }],
        };
      }),
      generationConfig: {
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        candidateCount: 1,
        maxOutputTokens: options.maxTokens,
        stopSequences: options.stop,
      },
    };
    const response = await this.fetch(apiUrl, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
    const data = await response.json();
    if (data[0]?.error) {
      throw new Error(data[0].error.message);
    }
    yield data[0]?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}

export default Gemini;
