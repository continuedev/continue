import {
  ToCoreFromWebviewProtocol,
  ToWebviewFromCoreProtocol,
} from "./coreWebview";
import { ToCoreFromIdeProtocol, ToIdeFromCoreProtocol } from "./ideCore";
import {
  ToIdeFromWebviewProtocol,
  ToWebviewFromIdeProtocol,
} from "./ideWebview";

export type IProtocol = Record<string, [any, any]>;

// IDE
export type ToIdeProtocol = ToIdeFromWebviewProtocol & ToIdeFromCoreProtocol;
export type FromIdeProtocol = ToWebviewFromIdeProtocol & ToCoreFromIdeProtocol;

// Webview
export type ToWebviewProtocol = ToWebviewFromIdeProtocol &
  ToWebviewFromCoreProtocol;
export type FromWebviewProtocol = ToIdeFromWebviewProtocol &
  ToCoreFromWebviewProtocol;

// Core
export type ToCoreProtocol = ToCoreFromIdeProtocol | ToCoreFromWebviewProtocol;
export type FromCoreProtocol = ToWebviewFromCoreProtocol &
  ToIdeFromCoreProtocol;
