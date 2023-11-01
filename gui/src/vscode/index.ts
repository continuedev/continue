import "vscode-webview";

declare const vscode: any;

function _postToIde(type: string, data: any) {
  if (typeof vscode === "undefined") {
    if (localStorage.getItem("ide") === "jetbrains" || true) {
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

export async function ideRequest(type: string, data: any): Promise<any> {
  return new Promise((resolve) => {
    const handler = (event: any) => {
      if (event.data.type === type) {
        window.removeEventListener("message", handler);
        resolve(event.data);
      }
    };
    window.addEventListener("message", handler);
    postToIde(type, data);
  });
}

export async function withProgress(title: string, fn: () => Promise<any>) {
  postToIde("withProgress", { title, done: false });
  return fn().finally(() => {
    postToIde("withProgress", { title, done: true });
  });
}
