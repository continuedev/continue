import { ChatMessage, IDE, LLMFullCompletionOptions, PromptLog, IEmbeddedSocketManager } from "core";
import type { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";
import { WebviewMessengerResult } from "core/protocol/util";
import { MessageIde } from "core/util/messageIde";
import { Message } from "core/util/messenger";
import { createContext } from "react";
import { v4 as uuidv4 } from "uuid";
import "vscode-webview";
import { isJetBrains, inSplitMode, getCurrentProject, getServerToken, getOverrideWsHost } from "../util";
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
  ): FromWebviewProtocol[T][1];

  llmStreamChat(
    modelTitle: string,
    cancelToken: AbortSignal | undefined,
    messages: ChatMessage[],
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<ChatMessage, PromptLog, unknown>;

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
      () => { },
    );
  }

  private embeddedSocketUrl(project: String) {
    const overrideWsHost = getOverrideWsHost()
    var host = location.host
    if (overrideWsHost && overrideWsHost.length > 0) {
      host = overrideWsHost
    }
    return `ws://${host}/project/${project}`
  }

  private _initWs(wsUrl: string, project: string, serverToken: string): Promise<{ socketInfo: IEmbeddedSocketManager }> {
    return new Promise((res, rej) => {
      const timeout = 5000;
      const socket = new WebSocket(wsUrl)
      const socketInfo: IEmbeddedSocketManager = {
        socket: socket,
        project: project,
        serverToken: serverToken,
        authed: false,
        isConnected: false,
        internal: {
        },
      }
      const resetTimeout = () => {
        clearTimeout(socketInfo.internal.timeout);
        socketInfo.internal.timeout = setTimeout(() => {
          socketInfo.error = new Error("Timeout occurred");
          rej(`Timeout trying to connect to socket: ${wsUrl}`);
        }, timeout);
      };
      resetTimeout();
      socket.onopen = () => {
        socketInfo.isConnected = true;
        resetTimeout();
        res({ socketInfo });
      }
      socket.onerror = (e) => {
        clearTimeout(socketInfo.internal.timeout);
        if (e instanceof ErrorEvent) {
          console.log(e.message) // and now TS can found the `message` property.
          socketInfo.error = Error(e.message);
          rej(`Error trying to connect to socket: ${wsUrl}, msg = ${e.message}}`);
        }
      }
      socket.onclose = () => {
        clearTimeout(socketInfo.internal.timeout);
        socketInfo.socket = null
        socketInfo.isConnected = false;
        socketInfo.authed = false;
      }
      // Log incoming messages to the console.
      socket.onmessage = (event) => {
        const data = event.data
        console.log('received: %s', event.data);
        if (data.startsWith("auth failed|")) {
          const retry = data.replace("auth failed|", "")
          socket.send(serverToken)
          socket.send(retry)
        } else if (data == "auth failed") {
          // status query response ,ignore it
        } else if (data == "auth succ") {
          socketInfo.authed = true
        } else {
          window.postMessage(JSON.parse(data), "*")
        }
      };
    });
  }
  private async reconnectWsAsync(project: string, token: string) {
    try {
      const wsUrl = this.embeddedSocketUrl(project)
      const { socketInfo } = await this._initWs(wsUrl, project, token);
      window.embeddedSocketInfo = socketInfo
    } catch (e) {
      console.log("init ws error:", e)
    }
  }
  private splitModeIdeaMsgHandler(messageType: string, data: any, messageId: string) {
    const msg = JSON.stringify({ messageType, data, messageId });
    console.log("splitModeIdeaMsgHandler msg:", msg);
    const socketInfo = window.embeddedSocketInfo
    const socket = socketInfo.socket
    socket.send(msg)
  }
  public ensureSocketConnected() {
    const currentProject = getCurrentProject();
    if (currentProject == null) {
      console.log("not ready, currentProject is empty");
      return
    }
    const serverToken = getServerToken()
    if (serverToken == null) {
      console.log("not ready, serverToken is empty");
      return
    }
    const socketInfo = window.embeddedSocketInfo
    if (socketInfo == null) {
      console.log("not ready, embeddedSocketInfo is empty");
      this.reconnectWsAsync(currentProject, serverToken)
      return
    }
    const socket = socketInfo.socket
    if (!socketInfo.isConnected) {
      console.log("not ready, isConnected is false");
      this.reconnectWsAsync(currentProject, serverToken)
      return
    }
    if (currentProject != socketInfo.project) {
      console.log(`current project changed, currentProject:${socketInfo.project}, oldProject: ${socketInfo.project}`);
      window.location.reload()
      return
    }
    if (!socketInfo.authed) {
      console.log("not ready, authed is false");
      socket.send(serverToken)
      //no return, avoid loss msg befor auth succ
    }
  }
  private _postToIde(messageType: string, data: any, messageId?: string) {
    if (typeof vscode === "undefined") {
      if (isJetBrains()) {
        if (window.postIntellijMessage === undefined) {
          if (inSplitMode()) {
            this.ensureSocketConnected()
            window.postIntellijMessage = this.splitModeIdeaMsgHandler
          } else {
            console.log(
              "Unable to send message: postIntellijMessage is undefined. ",
              messageType,
              data,
            );
            throw new Error("postIntellijMessage is undefined");
          }
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
          resolve(event.data.data);
        }
      };
      window.addEventListener("message", handler);

      this.post(messageType, data, messageId);
    }) as any;
  }

  async *streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): FromWebviewProtocol[T][1] {
    const messageId = uuidv4();

    this.post(messageType, data, messageId);

    let buffer = "";
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
          buffer += responseData.content;
        }
      }
    };
    window.addEventListener("message", handler);

    cancelToken?.addEventListener("abort", () => {
      this.post("abort", undefined, messageId);
    });

    while (!done) {
      if (buffer.length > index) {
        const chunk = buffer.slice(index);
        index = buffer.length;
        yield chunk;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (buffer.length > index) {
      const chunk = buffer.slice(index);
      index = buffer.length;
      yield chunk;
    }

    return returnVal;
  }

  async *llmStreamChat(
    modelTitle: string,
    cancelToken: AbortSignal | undefined,
    messages: ChatMessage[],
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<ChatMessage, PromptLog> {
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
      yield { role: "user", content: next.value };
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
