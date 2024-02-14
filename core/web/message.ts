import { v4 as uuidv4 } from "uuid";
import { ChatMessage, LLMFullCompletionOptions, LLMReturnValue } from "..";
interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;

function _postToIde(type: string, data: any) {
  if (typeof vscode === "undefined") {
    if (localStorage.getItem("ide") === "jetbrains") {
      if ((window as any).postIntellijMessage === undefined) {
        console.log(
          "Unable to send message: postIntellijMessage is undefined. ",
          type,
          data
        );
        throw new Error("postIntellijMessage is undefined");
      }
      (window as any).postIntellijMessage?.(type, data);
      return;
    } else {
      console.log("Unable to send message: vscode is undefined. ", type, data);
      return;
    }
  }
  vscode.postMessage({
    type,
    ...data,
  });
}

export function postToIde(type: string, data: any, attempt: number = 0) {
  try {
    _postToIde(type, data);
  } catch (error) {
    if (attempt < 5) {
      console.log(`Attempt ${attempt} failed. Retrying...`);
      setTimeout(
        () => postToIde(type, data, attempt + 1),
        Math.pow(2, attempt) * 1000
      );
    } else {
      console.error("Max attempts reached. Message could not be sent.", error);
    }
  }
}

export async function ideRequest(type: string, message: any): Promise<any> {
  // message, messageId, and type are passed back and forth
  const messageId = uuidv4();

  return new Promise((resolve) => {
    const handler = (event: any) => {
      if (event.data.messageId === messageId) {
        window.removeEventListener("message", handler);
        resolve(event.data.message);
      }
    };
    window.addEventListener("message", handler);

    postToIde(type, { message, messageId });
  });
}

export async function* ideStreamRequest(
  type: string,
  message: any,
  cancelToken?: AbortSignal
): AsyncGenerator<any, any> {
  const messageId = uuidv4();

  postToIde(type, { message, messageId });

  let buffer = "";
  let index = 0;
  let done = false;
  let returnVal = undefined;

  const handler = (event: any) => {
    if (event.data.messageId === messageId) {
      if (event.data.message.done) {
        window.removeEventListener("message", handler);
        done = true;
        returnVal = event.data.message.data;
      } else {
        buffer += event.data.message.content;
      }
    }
  };
  window.addEventListener("message", handler);

  cancelToken?.addEventListener("abort", () => {
    postToIde("abort", { messageId });
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
    "llmStreamChat",
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
