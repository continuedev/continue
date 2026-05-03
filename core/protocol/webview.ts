import { ConfigResult } from "@continuedev/config-yaml";
import { SerializedOrgWithProfiles } from "../config/ProfileLifecycleManager.js";
import { ControlPlaneSessionInfo } from "../control-plane/AuthTypes.js";
import type {
  BrowserSerializedContinueConfig,
  ContextItemWithId,
  ContextProviderName,
  IndexingProgressUpdate,
  IndexingStatus,
} from "../index.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [
    {
      result: ConfigResult<BrowserSerializedContinueConfig>;
      profileId: string | null;
      organizations: SerializedOrgWithProfiles[];
      selectedOrgId: string | null;
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
  sessionUpdate: [{ sessionInfo: ControlPlaneSessionInfo | undefined }, void];
  toolCallPartialOutput: [{ toolCallId: string; contextItems: any[] }, void];
  freeTrialExceeded: [undefined, void];
  /**
   * Sent by core to GUI when the agent invokes AskUserQuestion.
   * The GUI should render the question UI and reply via agent/questionAnswer.
   */
  "agent/askUserQuestion": [
    {
      sessionId: string;
      questions: import("../tools/definitions/askUserQuestion").AskUserQuestion[];
    },
    void,
  ];
};
