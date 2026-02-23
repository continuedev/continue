import { ToCoreFromIdeOrWebviewProtocol } from "./core.js";
import { ToIdeFromWebviewOrCoreProtocol } from "./ide.js";

export type ToIdeFromCoreProtocol = ToIdeFromWebviewOrCoreProtocol;
export type ToCoreFromIdeProtocol = ToCoreFromIdeOrWebviewProtocol;
