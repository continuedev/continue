import {
  ToCoreFromWebviewProtocol,
  ToWebviewFromCoreProtocol,
} from "./coreWebview.js";

// Message types to pass through from webview to core
export const WEBVIEW_TO_CORE_PASS_THROUGH: (keyof ToCoreFromWebviewProtocol)[] =
  [
    "update/modelChange",
    "ping",
    "abort",
    "history/list",
    "history/delete",
    "history/load",
    "history/save",
    "devdata/log",
    "config/addOpenAiKey",
    "config/addModel",
    "config/ideSettingsUpdate",
    "config/getBrowserSerialized",
    "config/deleteModel",
    "config/reload",
    "context/getContextItems",
    "context/loadSubmenuItems",
    "context/addDocs",
    "autocomplete/complete",
    "autocomplete/cancel",
    "autocomplete/accept",
    "command/run",
    "llm/complete",
    "llm/streamComplete",
    "llm/streamChat",
    "llm/listModels",
    "streamDiffLines",
    "stats/getTokensPerDay",
    "stats/getTokensPerModel",
    "index/setPaused",
    "index/forceReIndex",
    "index/indexingProgressBarInitialized",
    "completeOnboarding",
    "addAutocompleteModel",
  ];

// Message types to pass through from core to webview
export const CORE_TO_WEBVIEW_PASS_THROUGH: (keyof ToWebviewFromCoreProtocol)[] =
  ["configUpdate", "getDefaultModelTitle", "indexProgress"];
