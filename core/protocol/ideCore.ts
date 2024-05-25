import { ToCoreFromIdeOrWebviewProtocol } from "./core";
import { ToIdeFromWebviewOrCoreProtocol } from "./ide";

export type ToIdeFromCoreProtocol = ToIdeFromWebviewOrCoreProtocol;
export type ToCoreFromIdeProtocol = ToCoreFromIdeOrWebviewProtocol;
