import { ChatMessage, IDE, LLMFullCompletionOptions, PromptLog } from "core";
import type { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";
import { WebviewMessengerResult } from "core/protocol/util";
import { MessageIde } from "core/protocol/messenger/messageIde";
import { Message } from "core/protocol/messenger";
import { createContext } from "react";
import { v4 as uuidv4 } from "uuid";
import "vscode-webview";
import { isJetBrains } from "../util";

interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;

export interface IIdeMessenger {
  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt?: number,
  ): void;

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ): void;

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewMessengerResult<T>>;

  streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<unknown[]>;

  llmStreamChat(
    modelTitle: string,
    cancelToken: AbortSignal | undefined,
    messages: ChatMessage[],
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<ChatMessage[], PromptLog, unknown>;

  ide: IDE;
}

export class IdeMessenger implements IIdeMessenger {
  ide: IDE;

  constructor() {
    this.ide = new MessageIde(
      async (messageType, data) => {
        const result = await this.request(messageType, data);
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.content;
      },
      () => {},
    );
  }

  private _postToIde(messageType: string, data: any, messageId?: string) {
    if (typeof vscode === "undefined") {
      if (isJetBrains()) {
        if (window.postIntellijMessage === undefined) {
          console.log(
            "Unable to send message: postIntellijMessage is undefined. ",
            messageType,
            data,
          );
          throw new Error("postIntellijMessage is undefined");
        }
        messageId = messageId ?? uuidv4();
        window.postIntellijMessage?.(messageType, data, messageId);
        return;
      } else {
        console.log(
          "Unable to send message: vscode is undefined. ",
          messageType,
          data,
        );
        return;
      }
    }
    const msg: Message = {
      messageId: messageId ?? uuidv4(),
      messageType,
      data,
    };
    vscode.postMessage(msg);
  }

  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt: number = 0,
  ) {
    try {
      this._postToIde(messageType, data, messageId);
    } catch (error) {
      if (attempt < 5) {
        console.log(`Attempt ${attempt} failed. Retrying...`);
        setTimeout(
          () => this.post(messageType, data, messageId, attempt + 1),
          Math.pow(2, attempt) * 1000,
        );
      } else {
        console.error(
          "Max attempts reached. Message could not be sent.",
          error,
        );
      }
    }
  }

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ) {
    this._postToIde(messageType, data, messageId);
  }

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewMessengerResult<T>> {
    const messageId = uuidv4();

    return new Promise((resolve) => {
      const handler = (event: any) => {
        if (event.data.messageId === messageId) {
          window.removeEventListener("message", handler);
          resolve(event.data.data as WebviewMessengerResult<T>);
        }
      };
      window.addEventListener("message", handler);

      this.post(messageType, data, messageId);
    });
  }

  /**
   * Because of weird type stuff, we're actually yielding an array of the things
   * that are streamed. For example, if the return type here says
   * AsyncGenerator<ChatMessage>, then it's actually AsyncGenerator<ChatMessage[]>.
   * This needs to be handled by the caller.
   *
   * Using unknown for now to make this more explicit
   */
  async *streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<unknown[]> {
    // ): FromWebviewProtocol[T][1] {
    const messageId = uuidv4();

    this.post(messageType, data, messageId);

    const buffer: any[] = [];
    let index = 0;
    let done = false;
    let returnVal = undefined;

    const handler = (event: { data: Message }) => {
      if (event.data.messageId === messageId) {
        const responseData = event.data.data;
        if (responseData.done) {
          window.removeEventListener("message", handler);
          done = true;
          returnVal = responseData;
        } else {
          buffer.push(responseData.content);
        }
      }
    };
    window.addEventListener("message", handler);

    const handleAbort = () => {
      this.post("abort", undefined, messageId);
    };
    cancelToken?.addEventListener("abort", handleAbort);

    try {
      while (!done) {
        if (buffer.length > index) {
          const chunks = buffer.slice(index);
          index = buffer.length;
          yield chunks;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (buffer.length > index) {
        const chunks = buffer.slice(index);
        yield chunks;
      }

      return returnVal;
    } catch (e) {
      throw e;
    } finally {
      cancelToken?.removeEventListener("abort", handleAbort);
    }
  }

  async *llmStreamChat(
    modelTitle: string,
    cancelToken: AbortSignal | undefined,
    messages: ChatMessage[],
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<ChatMessage[], PromptLog> {
    const gen = this.streamRequest(
      "llm/streamChat",
      {
        messages,
        title: modelTitle,
        completionOptions: options,
      },
      cancelToken,
    );

    let next = await gen.next();
    while (!next.done) {
      yield next.value;
      next = await gen.next();
    }

    if (next.value.error) {
      throw new Error(next.value.error);
    }

    return {
      modelTitle: next.value.content?.modelTitle,
      prompt: next.value.content?.prompt,
      completion: next.value.content?.completion,
      completionOptions: next.value.content?.completionOptions,
    };
  }
}

export const IdeMessengerContext = createContext<IIdeMessenger>(
  new IdeMessenger(),
);
