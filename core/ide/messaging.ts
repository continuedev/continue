// import "vscode-webview";
import { v4 as uuidv4 } from "uuid";

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
  message: any
): AsyncGenerator<string> {
  const messageId = uuidv4();

  postToIde(type, { message, messageId });

  let buffer = "";
  let done = false;

  let staleTimeout = setTimeout(() => {
    console.warn("Stream request timed out.");
    done = true;
  }, 5000);

  const handler = (event: any) => {
    if (event.data.messageId === messageId) {
      if (event.data.message.done) {
        window.removeEventListener("message", handler);
        done = true;
      } else {
        buffer += event.data.message.content;
      }
      clearTimeout(staleTimeout);
      staleTimeout = setTimeout(() => {
        console.warn("Stream request timed out.");
        done = true;
      }, 5000);
    }
  };
  window.addEventListener("message", handler);

  while (!done) {
    if (buffer.length) {
      yield buffer;
      buffer = "";
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
