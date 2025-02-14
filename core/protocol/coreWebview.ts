import {
  OrganizationDescription,
  SessionState,
} from "../config/ProfileLifecycleManager.js";

import { ToCoreFromIdeOrWebviewProtocol } from "./core.js";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview.js";

export type ToCoreFromWebviewProtocol = ToCoreFromIdeOrWebviewProtocol & {
  "config/selectProfile": [{ id: string | null }, void];
  "controlPlane/selectOrg": [{ id: string | null }, void];
};
export type ToWebviewFromCoreProtocol = ToWebviewFromIdeOrCoreProtocol & {
  didChangeSessionState: [SessionState, void];
};
