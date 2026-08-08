import { FromWebviewProtocol } from ".";

export interface ErrorWebviewMessage {
  status: "error";
  error: string;
  done: true;
}

export interface SuccessWebviewSingleMessage<T> {
  done: true;
  status: "success";
  content: T;
}

export type WebviewSingleMessage<T> =
  | ErrorWebviewMessage
  | SuccessWebviewSingleMessage<T>;

export type WebviewSingleProtocolMessage<T extends keyof FromWebviewProtocol> =
  WebviewSingleMessage<FromWebviewProtocol[T][1]>;

// Generators
export type GeneratorYieldType<T> =
  T extends AsyncGenerator<infer Yield, any, any> ? Yield : never;
export type GeneratorReturnType<T> =
  T extends AsyncGenerator<any, infer Return, any> ? Return : never;

type SuccessWebviewGeneratorMessage<T, R> =
  | {
      status: "success";
      done: false;
      content: T;
    }
  | {
      status: "success";
      done: true;
      content: R;
    };

export type WebviewGeneratorMessage<T, R> =
  | SuccessWebviewGeneratorMessage<T, R>
  | ErrorWebviewMessage;

export type WebviewProtocolGeneratorMessage<
  T extends keyof FromWebviewProtocol,
> = WebviewGeneratorMessage<
  GeneratorYieldType<FromWebviewProtocol[T][1]>,
  GeneratorReturnType<FromWebviewProtocol[T][1]>
>;

export type WebviewMessage<T = unknown, R = unknown> =
  | WebviewSingleMessage<T>
  | WebviewGeneratorMessage<T, R>;
