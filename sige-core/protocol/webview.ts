import { ConfigResult } from "@continuedev/config-yaml";
import type {
  BrowserSerializedContinueConfig,
  ContextItemWithId,
  ContextProviderName,
  IndexingProgressUpdate,
  IndexingStatus,
} from "../index.js";
import type { ProfileDescription } from "../config/ProfileLifecycleManager.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [
    {
      result: ConfigResult<BrowserSerializedContinueConfig>;
      profileId: string | null;
      profiles: ProfileDescription[];
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
  sessionUpdate: [{ sessionInfo: any | undefined }, void];
  toolCallPartialOutput: [{ toolCallId: string; contextItems: any[] }, void];
};
