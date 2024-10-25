import { FromWebviewProtocol } from ".";

interface ErrorWebviewMessengerResult {
  done: boolean;
  status: "error";
  error: string;
}

interface SuccessWebviewMessengerResult<T extends keyof FromWebviewProtocol> {
  done: boolean;
  status: "success";
  content: FromWebviewProtocol[T][1];
}

export type WebviewMessengerResult<T extends keyof FromWebviewProtocol> =
  | ErrorWebviewMessengerResult
  | SuccessWebviewMessengerResult<T>;
