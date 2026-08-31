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

  // Sent whenever a tool call originates somewhere other than the GUI's own
  // streaming loop - the in-process shadow-code-tools MCP server driving the
  // Claude Code CLI (core/mcp/shadowCodeToolsServer.ts), or the subagent runner
  // (core/agent/subagentRunner.ts). Those callers reach Core's handleToolCall
  // directly, which executes unconditionally, so this is their equivalent of
  // the GUI's normal policy gate. Blocks until the user accepts/rejects when
  // the resolved policy is allowedWithPermission; resolves immediately
  // otherwise.
  "agent/authorizeToolCall": [
    {
      approvalId: string;
      toolCallId: string;
      sessionId?: string;
      toolName: string;
      args: Record<string, unknown>;
      displayTitle?: string;
      wouldLikeTo?: string;
      /** Which agent is asking, e.g. a subagent's task description. */
      agentLabel?: string;
    },
    { approved: boolean },
  ];
};
