import { getHeaders } from "../../pearaiServer/stubs/headers.js";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
  PearAuth,
} from "../../index.js";
import { SERVER_URL } from "../../util/parameters.js";
import { Telemetry } from "../../util/posthog.js";
import { BaseLLM } from "../index.js";
import { streamSse, streamResponse, streamJSON } from "../stream.js";
import { checkTokens } from "../../db/token.js";
import { stripImages } from "../images.js";
import {
  compileChatMessages,
  countTokens,
  pruneRawPromptFromTop,
} from "./../countTokens.js";


class PearAIServer extends BaseLLM {
  getCredentials: (() => Promise<PearAuth | undefined>) | undefined = undefined;
  setCredentials: (auth: PearAuth) => Promise<void> = async () => {};
  pearAIAccessToken: string | undefined = undefined;
  pearAIRefreshToken: string | undefined = undefined;


  static providerName: ModelProvider = "pearai_server";
  constructor(options: LLMOptions) {
    super(options);
    this.pearAIAccessToken = undefined;
    this.pearAIRefreshToken = undefined;
  }

  // Public setter for pearAIAccessToken
  public setPearAIAccessToken(value: string | undefined): void {
    this.pearAIAccessToken = value;
  }

  // Public setter for pearAIRefreshToken
  public setPearAIRefreshToken(value: string | undefined): void {
    this.pearAIRefreshToken = value;
  }

  private async _getHeaders() {
    await this._checkAndUpdateCredentials();
    return {
      "Content-Type": "application/json",
      ...(await getHeaders()),
    };
  }

  private async _countTokens(prompt: string, model: string, isPrompt: boolean) {
    if (!Telemetry.client) {
      throw new Error(
        'In order to use the server, telemetry must be enabled so that we can monitor abuse. To enable telemetry, set "allowAnonymousTelemetry": true in config.json and make sure the box is checked in IDE settings. If you use your own model (local or API key), telemetry will never be required.',
      );
    }
    const event = isPrompt
      ? "free_trial_prompt_tokens"
      : "free_trial_completion_tokens";
    Telemetry.capture(event, {
      tokens: this.countTokens(prompt),
      model,
    });
  }

  private _convertArgs(options: CompletionOptions): any {
    return {
      model: options.model,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      max_tokens: options.maxTokens,
      stop:
        options.model === "starcoder-7b"
          ? options.stop
          : options.stop?.slice(0, 2),
      temperature: options.temperature,
      top_p: options.topP,
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    )) {
      yield stripImages(chunk.content);
    }
  }

  countTokens(text: string): number {
    return countTokens(text, this.model);
  }


  protected _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }
    return {
      ...message,
      content: message.content.map((part) => {
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
      }),
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const args = this._convertArgs(this.collectArgs(options));

    await this._countTokens(
      messages.map((m) => m.content).join("\n"),
      args.model,
      true,
    );

    await this._checkAndUpdateCredentials();

    const body = JSON.stringify({
            messages: messages.map(this._convertMessage),
            ...args,
        });

    const response = await this.fetch(`${SERVER_URL}/server_chat`, {
      method: "POST",
      headers: {
        ...(await this._getHeaders()),
        Authorization: `Bearer ${this.pearAIAccessToken}`,
      },
      body: body,
    });

    let completion = "";

    for await (const value of streamJSON(response)) {
      // Handle initial metadata if necessary
      if (value.metadata && Object.keys(value.metadata).length > 0) {
        // Do something with metadata if needed, currently just logging
        console.log("Metadata received:", value.metadata);
      }

      if (value.content) {
        yield {
          role: "assistant",
          content: value.content,
        };
        completion += value.content;
      }
    }
    this._countTokens(completion, args.model, false);
  }

  async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    options.stream = true;

    let user_logged_in = await this._checkAndUpdateCredentials();
    if (!user_logged_in) {
      return null
    }

    const endpoint = `${SERVER_URL}/server_fim`;
    const resp = await this.fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
        model: options.model,
          prefix,
          suffix,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: true,
        }),
      headers: {
        ...(await this._getHeaders()),
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.pearAIAccessToken}`,
      },
    });
    let completion = "";
    for await (const chunk of streamSse(resp)) {
      yield chunk.choices[0].delta.content;
    }
  }


  async listModels(): Promise<string[]> {
    return [
      "pearai_model",
    ];
  }
  supportsFim(): boolean {
    // Todo: Change to true when server is ready
    return false;
  }

  private async _checkAndUpdateCredentials(): Promise<boolean> {
    try {
      let creds = undefined;


      if (this.getCredentials && this.pearAIAccessToken === undefined) {
        console.log("Attempting to get credentials...");
        creds = await this.getCredentials();

        if (creds && creds.accessToken && creds.refreshToken) {
          this.pearAIAccessToken = creds.accessToken;
          this.pearAIRefreshToken = creds.refreshToken;
        }
        else {
          return false;
        }
      }

      const tokens = await checkTokens(this.pearAIAccessToken, this.pearAIRefreshToken);

      if (tokens.accessToken !== this.pearAIAccessToken || tokens.refreshToken !== this.pearAIRefreshToken) {
        if (tokens.accessToken !== this.pearAIAccessToken) {
          this.pearAIAccessToken = tokens.accessToken;
          console.log(
            "PearAI access token changed from:",
            this.pearAIAccessToken,
            "to:",
            tokens.accessToken,
          );
        }

        if (tokens.refreshToken !== this.pearAIRefreshToken) {
          this.pearAIRefreshToken = tokens.refreshToken;
          console.log(
            "PearAI refresh token changed from:",
            this.pearAIRefreshToken,
            "to:",
            tokens.refreshToken,
          );
        }
        if (creds) {
          creds.accessToken = tokens.accessToken
          creds.refreshToken = tokens.refreshToken
          this.setCredentials(creds)
        }
      }
    } catch (error) {
      console.error("Error checking token expiration:", error);
      // Handle the error (e.g., redirect to login page)
    }
    return true
  }

  protected async _sendTokensUsed(
    kind: string,
    prompt: string,
    completion: string,
  ) {
    let promptTokens = this.countTokens(prompt);
    let generatedTokens = this.countTokens(completion);

    const response = await this.fetch(`${SERVER_URL}/log_tokens`, {
      method: "POST",
      headers: {
        ...(await this._getHeaders()),
        Authorization: `Bearer ${this.pearAIAccessToken}`,
      },
      body: JSON.stringify({
        kind,
        promptTokens,
        generatedTokens
      }),
    })
  }
}

export default PearAIServer;
