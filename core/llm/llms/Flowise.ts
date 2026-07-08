import socketIOClient, { Socket } from "socket.io-client";

import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

interface IFlowiseApiOptions {
  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  /** Total probability mass of tokens to consider at each step */
  topP?: number;

  /** Integer to define the top tokens considered within the sample operation to create new text. */
  topK?: number;

  presencePenalty?: number;

  /** Penalizes repeated tokens according to frequency */
  frequencyPenalty?: number;

  // Flowise allows you to pass custom properties
  [key: string]: any;
}

interface IFlowiseSocketManager {
  isConnected: boolean;
  hasNextToken: () => Promise<boolean>;
  internal: {
    timeout?: NodeJS.Timeout;
    hasNextTokenPromiseResolve: (value: boolean | PromiseLike<boolean>) => void;
    hasNextTokenPromiseReject: (reason?: any) => void;
    messageHistory: string[];
  };
  error?: Error;
  getCurrentMessage: () => string;
}

interface IFlowiseKeyValueProperty {
  key: string;
  value: any;
}

interface IFlowiseProviderLLMOptions extends LLMOptions {
  timeout?: number;
  additionalHeaders?: IFlowiseKeyValueProperty[];
  additionalFlowiseConfiguration?: IFlowiseKeyValueProperty[];
}

class Flowise extends BaseLLM {
  static providerName = "flowise";
  static defaultOptions: Partial<IFlowiseProviderLLMOptions> = {
    apiBase: "http://localhost:3000",
  };
  static FlowiseMessageType = {
    User: "userMessage",
    Assistant: "apiMessage",
  };

  protected additionalFlowiseConfiguration: IFlowiseKeyValueProperty[] = [];
  protected timeout = 5000;
  protected additionalHeaders: IFlowiseKeyValueProperty[] = [];

  constructor(options: IFlowiseProviderLLMOptions) {
    super(options);
    this.timeout = options.timeout ?? 5000;
    this.additionalHeaders = options.additionalHeaders ?? [];
    this.additionalFlowiseConfiguration =
      options.additionalFlowiseConfiguration ?? [];
  }

  private _getChatUrl(): string {
    return String(this.apiBase);
  }

  private _getSocketUrl(): string {
    return new URL(this._getChatUrl()).origin;
  }

  private _getHeaders(): HeadersInit | undefined {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    for (const additionalHeader of this.additionalHeaders) {
      headers[additionalHeader.key] = additionalHeader.value;
    }

    return headers;
  }

  protected _convertArgs(options: CompletionOptions): IFlowiseApiOptions {
    const finalOptions: IFlowiseApiOptions = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      topK: options.topK,
      presencePenalty: options.presencePenalty,
      frequencyPenalty: options.frequencyPenalty,
    };

    for (const additionalConfig of this.additionalFlowiseConfiguration) {
      finalOptions[additionalConfig.key] = additionalConfig.value;
    }
    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const message: ChatMessage = { role: "user", content: prompt };
    for await (const chunk of this._streamChat([message], signal, options)) {
      yield renderChatMessage(chunk);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const requestBody = this._getRequestBody(messages, options);
    const { socket, socketInfo } = await this._initializeSocket();
    const response = await this.fetch(this._getChatUrl(), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({ ...requestBody, socketIOClientId: socket.id }),
      signal,
    });

    if (response.status === 499) {
      return; // Aborted by user
    }

    while (await socketInfo.hasNextToken()) {
      yield { role: "assistant", content: socketInfo.getCurrentMessage() };
    }
    if (socketInfo.error) {
      socket.disconnect();
      try {
        yield { role: "assistant", content: await response.text() };
      } catch (error: any) {
        yield { role: "assistant", content: (error as Error).message ?? error };
      }
    }
    socket.disconnect();
  }

  protected _getRequestBody(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): any {
    const lastMessage = messages[messages.length - 1];
    const history = messages
      .filter((m) => m !== lastMessage)
      .map((m) => ({
        type:
          m.role === "user"
            ? Flowise.FlowiseMessageType.User
            : Flowise.FlowiseMessageType.Assistant,
        message: m.content,
      }));
    const requestBody = {
      question: lastMessage.content,
      history: history,
      overrideConfig: this._convertArgs(options),
    };
    return requestBody;
  }

  protected _initializeSocket(): Promise<{
    socket: Socket;
    socketInfo: IFlowiseSocketManager;
  }> {
    return new Promise((res, rej) => {
      const socket = socketIOClient(this._getSocketUrl());
      const socketInfo: IFlowiseSocketManager = {
        isConnected: false,
        hasNextToken: () => Promise.resolve(false),
        internal: {
          hasNextTokenPromiseResolve: () => {},
          hasNextTokenPromiseReject: () => {},
          messageHistory: [],
        },
        getCurrentMessage: () => "",
      };
      socketInfo.getCurrentMessage = () =>
        socketInfo.internal.messageHistory.shift() ?? "";
      socketInfo.hasNextToken = () => {
        return new Promise<boolean>(
          (hasNextTokenResolve, hasNextTokenReject) => {
            socketInfo.internal.hasNextTokenPromiseResolve =
              hasNextTokenResolve;
            socketInfo.internal.hasNextTokenPromiseReject = hasNextTokenReject;
          },
        );
      };
      const resetTimeout = () => {
        clearTimeout(socketInfo.internal.timeout);
        socketInfo.internal.timeout = setTimeout(() => {
          socketInfo.error = new Error("Timeout occurred");
          socketInfo.internal.hasNextTokenPromiseResolve(false);
          rej(`Timeout trying to connect to socket: ${this._getSocketUrl()}`);
        }, this.timeout);
      };
      resetTimeout();
      socket.on("connect", () => {
        socketInfo.isConnected = true;
        resetTimeout();
        res({ socket, socketInfo });
      });
      socket.on("token", (token) => {
        if (socketInfo.isConnected) {
          socketInfo.internal.messageHistory.push(token);
          resetTimeout();
          socketInfo.internal.hasNextTokenPromiseResolve(true);
        }
      });
      socket.on("error", (error) => {
        clearTimeout(socketInfo.internal.timeout);
        socketInfo.error = error;
        socketInfo.internal.hasNextTokenPromiseResolve(false);
        rej(`Error trying to connect to socket: ${this._getSocketUrl()}`);
      });
      socket.on("end", () => {
        clearTimeout(socketInfo.internal.timeout);
        socketInfo.hasNextToken = () =>
          Promise.resolve(Boolean(socketInfo.internal.messageHistory.length));
      });
      socket.on("disconnect", () => {
        socketInfo.isConnected = false;
        clearTimeout(socketInfo.internal.timeout);
        socketInfo.internal.hasNextTokenPromiseResolve(false);
      });
    });
  }
}

export default Flowise;
