import { ToCoreFromIdeOrWebviewProtocol } from "./core.js";
import { MCPAppProtocol } from "./mcpApps.js";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview.js";

export type ToCoreFromWebviewProtocol = ToCoreFromIdeOrWebviewProtocol & {
  didChangeSelectedProfile: [{ id: string }, void];
  didChangeSelectedOrg: [{ id: string; profileId?: string }, void];
};
export type ToWebviewFromCoreProtocol = ToWebviewFromIdeOrCoreProtocol &
  MCPAppProtocol;
