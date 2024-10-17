declare module "vscode-webview" {
  export interface WebviewApi<T> {
    postMessage(message: T): void;
    getState(): T | undefined;
    setState<S extends T>(newState: S): S;
  }
}
