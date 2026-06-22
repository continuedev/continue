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
<<<<<<< HEAD
    "history/loadRemote",
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    "history/save",
    "history/clear",
    "devdata/log",
    "config/addModel",
    "config/newPromptFile",
    "config/newAssistantFile",
    "config/ideSettingsUpdate",
    "config/addLocalWorkspaceBlock",
    "config/addGlobalRule",
    "config/deleteRule",
    "config/getSerializedProfileInfo",
    "config/deleteModel",
    "config/refreshProfiles",
    "config/openProfile",
    "config/updateSharedConfig",
    "config/updateSelectedModel",
    "mcp/reloadServer",
    "mcp/getPrompt",
    "mcp/startAuthentication",
    "mcp/removeAuthentication",
    "mcp/setServerEnabled",
    "context/getContextItems",
    "context/getSymbolsForFiles",
    "context/loadSubmenuItems",
    "context/addDocs",
    "context/removeDocs",
    "context/indexDocs",
    "autocomplete/complete",
    "autocomplete/cancel",
    "autocomplete/accept",
    "nextEdit/predict",
    "nextEdit/reject",
    "nextEdit/accept",
    "nextEdit/startChain",
    "nextEdit/deleteChain",
    "nextEdit/isChainAlive",
    "nextEdit/queue/getProcessedCount",
    "nextEdit/queue/dequeueProcessed",
    "nextEdit/queue/processOne",
    "nextEdit/queue/clear",
    "nextEdit/queue/abort",
    "tts/kill",
    "llm/complete",
    "llm/streamChat",
    "llm/listModels",
    "llm/compileChat",
    "streamDiffLines",
    "chatDescriber/describe",
    "conversation/compact",
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
    "docs/getIndexedPages",
    //
    "onboarding/complete",
    "addAutocompleteModel",
    "didChangeSelectedProfile",
<<<<<<< HEAD
    "didChangeSelectedOrg",
    "tools/call",
    "tools/evaluatePolicy",
    "tools/preprocessArgs",
    "controlPlane/getEnvironment",
    "controlPlane/getCreditStatus",
    "controlPlane/openUrl",
=======
    "tools/call",
    "tools/evaluatePolicy",
    "tools/preprocessArgs",
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    "isItemTooBig",
    "process/markAsBackgrounded",
    "process/isBackgrounded",
    "process/killTerminalProcess",
<<<<<<< HEAD
=======
    "models/fetch",
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
<<<<<<< HEAD
    "freeTrialExceeded",
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  ];
