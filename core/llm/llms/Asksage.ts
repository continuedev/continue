import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

/**
 * Asksage is a class that interfaces with the Ask Sage API.
 */
class Asksage extends BaseLLM {
  static providerName: ModelProvider = "ask-sage"; // Provider Name
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.asksage.ai/server/", // Base URL for Ask Sage API
    model: "gpt-4o", // Default model
  };

  // Supported models and their corresponding API identifiers
  private static modelConversion: { [key: string]: string } = {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    // Add other models as needed
  };

  constructor(options: LLMOptions) {
    super(options);
    this.apiVersion = options.apiVersion ?? "v1";
  }

  /**
   * Converts the given model name to the corresponding model identifier used by the API.
   * @param model - The model name.
   * @returns The API-specific model identifier.
   */
  protected _convertModelName(model: string): string {
    return Asksage.modelConversion[model] ?? model;
  }

  /**
   * Converts a ChatMessage into the format required by the Ask Sage API.
   * @param message - The ChatMessage to convert.
   * @returns The converted message.
   */
  protected _convertMessage(message: ChatMessage) {
    return {
      user: message.role === "assistant" ? "gpt" : "me",
      message:
        typeof message.content === "string"
          ? message.content
          : message.content.map((part) => part.text).join(""),
    };
  }

  /**
   * Prepares the arguments for the API request.
   * @param options - The completion options.
   * @param messages - An array of ChatMessage objects.
   * @returns The arguments for the API request.
   */
  protected _convertArgs(options: any, messages: ChatMessage[]) {
    // Format message as per API requirement
    let formattedMessage: any;
    if (messages.length === 1) {
      // Single message
      formattedMessage = messages[0].content;
    } else {
      // Array of messages
      formattedMessage = messages.map(this._convertMessage);
    }

    const args: any = {
      message: formattedMessage,
      persona: options.persona ?? "default",
      dataset: options.dataset ?? "all",
      limit_references: options.limitReferences ?? 0,
      temperature: options.temperature ?? 0.0,
      live: options.live ?? 0,
      model: this._convertModelName(options.model),
      system_prompt: options.systemPrompt,
      tools: options.tools,
      tool_choice: options.toolChoice,
      // Add other parameters as required by your API
    };

    // Remove undefined properties
    Object.keys(args).forEach(
      (key) => args[key] === undefined && delete args[key]
    );

    return args;
  }

  /**
   * Gets the headers required for the API requests.
   * @returns An object containing header key-value pairs.
   */
  protected _getHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["x-access-tokens"] = this.apiKey; // Use x-access-tokens as per API requirement
    }

    return headers;
  }

  /**
   * Constructs the full URL for a given API endpoint.
   * @param endpoint - The endpoint path.
   * @returns A URL object representing the full API endpoint URL.
   */
  protected _getEndpoint(endpoint: string) {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option."
      );
    }

    return new URL(endpoint, this.apiBase);
  }

  /**
   * Sends a completion request to the API and returns the response.
   * @param prompt - The input prompt for the language model.
   * @param options - Additional completion options.
   * @returns The generated completion text.
   */
  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    // Input validation to prevent injections
    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error("Prompt must be a non-empty string.");
    }

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];

    const args = this._convertArgs(options, messages);

    const response = await this.fetch(this._getEndpoint("query"), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.response; // Adjust based on your API's response structure
  }

  /**
   * Streams completion data from the API.
   * Note: If streaming is not supported, you can remove this method or adjust accordingly.
   * @param prompt - The input prompt for the language model.
   * @param options - Additional completion options.
   * @returns An async generator yielding completion text chunks.
   */
  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    // Since streaming is not indicated, yield the full completion
    const completion = await this._complete(prompt, options);
    yield completion;
  }

  /**
   * Streams chat messages from the API.
   * @param messages - An array of ChatMessage objects.
   * @param options - Additional completion options.
   * @returns An async generator yielding ChatMessage chunks.
   */
  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const args = this._convertArgs(options, messages);

    const response = await this.fetch(this._getEndpoint("query"), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Construct a ChatMessage from the response
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: data.response, // Adjust based on your API's response structure
    };

    yield assistantMessage;
  }

  /**
   * Retrieves a list of available models from the API.
   * @returns A promise that resolves to an array of model names.
   */
  async listModels(): Promise<string[]> {
    // If your API provides an endpoint to list models, implement it here
    // For now, return the keys from modelConversion
    return Object.keys(Asksage.modelConversion);
  }
}

export default Asksage;