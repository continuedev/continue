import {
  ToCoreFromWebviewProtocol,
  ToWebviewFromCoreProtocol,
} from "./coreWebview.js";

// Message types to pass through from webview to core
// Note: If updating these values, make a corresponding update in
// extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/toolWindow/ContinueBrowser.kt
export const WEBVIEW_TO_CORE_PASS_THROUGH: (keyof ToCoreFromWebviewProtocol)[] =
  [
    "ping",
    "abort",
    "history/list",
    "history/delete",
    "history/load",
    "history/save",
    "history/clear",
    "devdata/log",
    "config/addModel",
    "config/newPromptFile",
    "config/ideSettingsUpdate",
    "config/addLocalWorkspaceBlock",
    "config/getSerializedProfileInfo",
    "config/deleteModel",
    "config/refreshProfiles",
    "config/openProfile",
    "config/updateSharedConfig",
    "config/updateSelectedModel",
    "mcp/reloadServer",
    "context/getContextItems",
    "context/getSymbolsForFiles",
    "context/loadSubmenuItems",
    "context/addDocs",
    "context/removeDocs",
    "context/indexDocs",
    "autocomplete/complete",
    "autocomplete/cancel",
    "autocomplete/accept",
    "tts/kill",
    "llm/complete",
    "llm/streamChat",
    "llm/listModels",
    "streamDiffLines",
    "chatDescriber/describe",
    "stats/getTokensPerDay",
    "stats/getTokensPerModel",
    // Codebase
    "index/setPaused",
    "index/forceReIndex",
    "index/indexingProgressBarInitialized",
    // Docs, etc.
    "indexing/reindex",
    "indexing/abort",
    "indexing/setPaused",
    "docs/initStatuses",
    "docs/getDetails",
    //
    "completeOnboarding",
    "addAutocompleteModel",
    "didChangeSelectedProfile",
    "didChangeSelectedOrg",
    "tools/call",
    "controlPlane/openUrl",
    "isItemTooBig",
    "process/markAsBackgrounded",
    "process/isBackgrounded",
  ];

// Message types to pass through from core to webview
// Note: If updating these values, make a corresponding update in
// extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/constants/MessageTypes.kt
export const CORE_TO_WEBVIEW_PASS_THROUGH: (keyof ToWebviewFromCoreProtocol)[] =
  [
    "configUpdate",
    "indexProgress", // Codebase
    "indexing/statusUpdate", // Docs, etc.
    "addContextItem",
    "refreshSubmenuItems",
    "isContinueInputFocused",
    "setTTSActive",
    "getWebviewHistoryLength",
    "getCurrentSessionId",
    "sessionUpdate",
    "didCloseFiles",
    "toolCallPartialOutput",
  ];
