import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessageContent,
} from "../../index.js";
import { BaseLLM } from "../index.js";
import { toChatBody } from "../openaiTypeConverters.js";

/**
 * Flatten content from array format to plain string.
 * Hatz API requires content to be a string, not an array of content parts.
 */
function flattenContent(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { type: "text"; text: string } =>
          typeof part === "object" && part.type === "text",
      )
      .map((part) => part.text)
      .join("\n");
  }
  return String(content ?? "");
}

class HatzAI extends BaseLLM {
  static providerName = "hatz";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://ai.hatz.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  public useLegacyCompletionsEndpoint: boolean = false;

  constructor(options: LLMOptions) {
    super(options);
    this.useLegacyCompletionsEndpoint = false;
  }

  // Hatz does not support the legacy /completions endpoint
  supportsCompletions(): boolean {
    return false;
  }

  // Hatz does not support FIM
  supportsFim(): boolean {
    return false;
  }

  protected _getHeaders() {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey && { "X-API-Key": this.apiKey }),
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
    };
  }

  protected _getEndpoint(
    endpoint: "chat/completions" | "completions" | "models" | "responses",
  ) {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option in config.yaml",
      );
    }
    // Hatz uses /chat/models instead of /models
    if (endpoint === "models") {
      return new URL("chat/models", this.apiBase);
    }
    return new URL(endpoint, this.apiBase);
  }

  /**
   * Convert messages to Hatz-compatible format.
   * Flattens all content arrays to plain strings.
   */
  private _convertMessagesForHatz(body: any): any {
    const messages = body.messages.map((msg: any) => ({
      ...msg,
      content: flattenContent(msg.content),
    }));

    // Build Hatz request body
    const hatzBody: any = {
      ...body, // Keep tools, tool_choice, etc.
      messages, // Override with flattened messages
      stream: body.stream ?? false,
    };

    // Map standard parameters
    if (body.temperature !== undefined) hatzBody.temperature = body.temperature;
    if (body.top_p !== undefined) hatzBody.top_p = body.top_p;
    if (body.stop !== undefined) hatzBody.stop = body.stop;
    if (body.max_tokens !== undefined) hatzBody.max_tokens = body.max_tokens;
    if (body.frequency_penalty !== undefined)
      hatzBody.frequency_penalty = body.frequency_penalty;
    if (body.presence_penalty !== undefined)
      hatzBody.presence_penalty = body.presence_penalty;

    return hatzBody;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const body = toChatBody(messages, options, {});

    const hatzBody = this._convertMessagesForHatz(body);

    // Always use non-streaming for now since Hatz streaming
    // uses a custom NDJSON format, not OpenAI SSE
    hatzBody.stream = false;

    const response = await this.fetch(this._getEndpoint("chat/completions"), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(hatzBody),
      signal,
    });

    if ((response as any).status === 499) {
      return; // Aborted by user
    }

    if ((response as any).status >= 400) {
      const errorText = await response.text();
      throw new Error(
        `Hatz API error ${(response as any).status}: ${errorText}`,
      );
    }

    const data = await response.json();

    if (data.choices?.[0]?.message) {
      yield {
        role: "assistant",
        content: data.choices[0].message.content ?? "",
      };
    }
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): Promise<string> {
    let completion = "";
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      completion += chunk.content;
    }
    return completion;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      yield typeof chunk.content === "string" ? chunk.content : "";
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetch(this._getEndpoint("models"), {
      method: "GET",
      headers: this._getHeaders(),
    });

    const data = await response.json();
    // Hatz returns { data: [{ name: "model-id", display_name: "...", ... }] }
    return data.data.map((m: any) => m.name);
  }
}

export default HatzAI;
