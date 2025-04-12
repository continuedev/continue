import { ToCoreFromIdeOrWebviewProtocol } from "./core.js";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview.js";

export type ToCoreFromWebviewProtocol = ToCoreFromIdeOrWebviewProtocol & {
  didChangeSelectedProfile: [{ id: string | null }, void];
  didChangeSelectedOrg: [
    { id: string | null; profileId?: string | null },
    void,
  ];
  toolCallPartialOutput: [
    { toolCallId: string; contextItems: any[] },
    void,
  ];
};
export type ToWebviewFromCoreProtocol = ToWebviewFromIdeOrCoreProtocol;
