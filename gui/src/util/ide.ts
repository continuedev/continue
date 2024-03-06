import { ChatMessage, LLMFullCompletionOptions, LLMReturnValue } from "core";
import { Message } from "core/util/messenger";
import {
  ReverseWebviewProtocol,
  WebviewProtocol,
} from "core/web/webviewProtocol";
import { v4 as uuidv4 } from "uuid";
import "vscode-webview";
interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;

function _postToIde(messageType: string, data: any, messageId?: string) {
  if (typeof vscode === "undefined") {
    if (localStorage.getItem("ide") === "jetbrains") {
      if (window.postIntellijMessage === undefined) {
        console.log(
          "Unable to send message: postIntellijMessage is undefined. ",
          messageType,
          data
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
        data
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

export function postToIde<T extends keyof WebviewProtocol>(
  messageType: T,
  data: WebviewProtocol[T][0],
  messageId?: string,
  attempt: number = 0
) {
  try {
    _postToIde(messageType, data, messageId);
  } catch (error) {
    if (attempt < 5) {
      console.log(`Attempt ${attempt} failed. Retrying...`);
      setTimeout(
        () => postToIde(messageType, data, messageId, attempt + 1),
        Math.pow(2, attempt) * 1000
      );
    } else {
      console.error("Max attempts reached. Message could not be sent.", error);
    }
  }
}

export function respondToIde<T extends keyof ReverseWebviewProtocol>(
  messageType: T,
  data: ReverseWebviewProtocol[T][1],
  messageId: string
) {
  _postToIde(messageType, data, messageId);
}

function safeParseResponse(data: any) {
  let responseData = data ?? null;
  try {
    responseData = JSON.parse(responseData);
  } catch {}
  return responseData;
}

export async function ideRequest<T extends keyof WebviewProtocol>(
  messageType: T,
  data: WebviewProtocol[T][0]
): Promise<WebviewProtocol[T][1]> {
  const messageId = uuidv4();

  return new Promise((resolve) => {
    const handler = (event: any) => {
      if (event.data.messageId === messageId) {
        window.removeEventListener("message", handler);
        resolve(safeParseResponse(event.data.data));
      }
    };
    window.addEventListener("message", handler);

    postToIde(messageType, data, messageId);
  }) as any;
}

export async function* ideStreamRequest<T extends keyof WebviewProtocol>(
  messageType: T,
  data: WebviewProtocol[T][0],
  cancelToken?: AbortSignal
): WebviewProtocol[T][1] {
  const messageId = uuidv4();

  postToIde(messageType, data, messageId);

  let buffer = "";
  let index = 0;
  let done = false;
  let returnVal = undefined;

  const handler = (event: { data: Message }) => {
    if (event.data.messageId === messageId) {
      const responseData = safeParseResponse(event.data.data);
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
    postToIde("abort", undefined, messageId);
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

export async function* llmStreamChat(
  modelTitle: string,
  cancelToken: AbortSignal | undefined,
  messages: ChatMessage[],
  options: LLMFullCompletionOptions = {}
): AsyncGenerator<ChatMessage, LLMReturnValue> {
  const gen = ideStreamRequest(
    "llm/streamChat",
    {
      messages,
      title: modelTitle,
      completionOptions: options,
    },
    cancelToken
  );

  let next = await gen.next();
  while (!next.done) {
    yield { role: "user", content: next.value };
    next = await gen.next();
  }
  return { prompt: next.value?.prompt, completion: next.value?.completion };
}

export function appendText(text: string) {
  const div = document.createElement("div");
  div.innerText = text;
  document.body.appendChild(div);
}

export function isJetBrains() {
  return localStorage.getItem("ide") === "jetbrains";
}
