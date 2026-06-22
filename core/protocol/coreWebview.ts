import { ToCoreFromIdeOrWebviewProtocol } from "./core.js";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview.js";

export type ToCoreFromWebviewProtocol = ToCoreFromIdeOrWebviewProtocol & {
  didChangeSelectedProfile: [{ id: string }, void];
<<<<<<< HEAD
  didChangeSelectedOrg: [{ id: string; profileId?: string }, void];
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
};
export type ToWebviewFromCoreProtocol = ToWebviewFromIdeOrCoreProtocol;
