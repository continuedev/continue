import { ConfigResult } from "@continuedev/config-yaml";
<<<<<<< HEAD
import { SerializedOrgWithProfiles } from "../config/ProfileLifecycleManager.js";
import { ControlPlaneSessionInfo } from "../control-plane/AuthTypes.js";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import type {
  BrowserSerializedContinueConfig,
  ContextItemWithId,
  ContextProviderName,
  IndexingProgressUpdate,
  IndexingStatus,
} from "../index.js";
<<<<<<< HEAD
=======
import type { ProfileDescription } from "../config/ProfileLifecycleManager.js";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [
    {
      result: ConfigResult<BrowserSerializedContinueConfig>;
      profileId: string | null;
<<<<<<< HEAD
      organizations: SerializedOrgWithProfiles[];
      selectedOrgId: string | null;
=======
      profiles: ProfileDescription[];
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    },
    void,
  ];
  getDefaultModelTitle: [undefined, string | undefined];
  indexProgress: [IndexingProgressUpdate, void]; // Codebase
  "indexing/statusUpdate": [IndexingStatus, void]; // Docs, etc.
  refreshSubmenuItems: [
    {
      providers: "all" | "dependsOnIndexing" | ContextProviderName[];
    },
    void,
  ];
  didCloseFiles: [{ uris: string[] }, void];
  isContinueInputFocused: [undefined, boolean];
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
  setTTSActive: [boolean, void];
  getWebviewHistoryLength: [undefined, number];
  getCurrentSessionId: [undefined, string];
  "jetbrains/setColors": [Record<string, string | null | undefined>, void];
<<<<<<< HEAD
  sessionUpdate: [{ sessionInfo: ControlPlaneSessionInfo | undefined }, void];
  toolCallPartialOutput: [{ toolCallId: string; contextItems: any[] }, void];
  freeTrialExceeded: [undefined, void];
=======
  sessionUpdate: [{ sessionInfo: any | undefined }, void];
  toolCallPartialOutput: [{ toolCallId: string; contextItems: any[] }, void];
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
};
