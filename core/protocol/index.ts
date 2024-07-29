import {
  ToCoreFromWebviewProtocol,
  ToWebviewFromCoreProtocol,
} from "./coreWebview.js";
import { ToWebviewOrCoreFromIdeProtocol } from "./ide.js";
import { ToCoreFromIdeProtocol, ToIdeFromCoreProtocol } from "./ideCore.js";
import {
  ToIdeFromWebviewProtocol,
  ToWebviewFromIdeProtocol,
} from "./ideWebview.js";

export type IProtocol = Record<string, [any, any]>;

// IDE
export type ToIdeProtocol = ToIdeFromWebviewProtocol & ToIdeFromCoreProtocol;
export type FromIdeProtocol = ToWebviewFromIdeProtocol &
  ToCoreFromIdeProtocol &
  ToWebviewOrCoreFromIdeProtocol;

// Webview
export type ToWebviewProtocol = ToWebviewFromIdeProtocol &
  ToWebviewFromCoreProtocol &
  ToWebviewOrCoreFromIdeProtocol;
export type FromWebviewProtocol = ToIdeFromWebviewProtocol &
  ToCoreFromWebviewProtocol;

// Core
export type ToCoreProtocol = ToCoreFromIdeProtocol &
  ToCoreFromWebviewProtocol &
  ToWebviewOrCoreFromIdeProtocol;
export type FromCoreProtocol = ToWebviewFromCoreProtocol &
  ToIdeFromCoreProtocol;
