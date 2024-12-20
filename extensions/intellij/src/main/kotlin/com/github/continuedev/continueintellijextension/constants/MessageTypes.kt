package com.github.continuedev.continueintellijextension.constants

class MessageTypes {
    companion object {
        val generatorTypes = listOf(
            "llm/streamComplete",
            "llm/streamChat",
            "command/run",
            "streamDiffLines"
        )

        val ideMessageTypes = listOf(
            "readRangeInFile",
            "isTelemetryEnabled",
            "getUniqueId",
            "getWorkspaceConfigs",
            "getDiff",
            "getTerminalContents",
            "getWorkspaceDirs",
            "showLines",
            "writeFile",
            "fileExists",
            "showVirtualFile",
            "openFile",
            "runCommand",
            "saveFile",
            "readFile",
            "showDiff",
            "getOpenFiles",
            "getCurrentFile",
            "getPinnedFiles",
            "getSearchResults",
            "getProblems",
            "subprocess",
            "getBranch",
            "getTags",
            "getIdeInfo",
            "getIdeSettings",
            "getRepoName",
            "listDir",
            "getGitRootPath",
            "getLastModified",
            "insertAtCursor",
            "applyToFile",
            "getGitHubAuthToken",
            "setGitHubAuthToken",
            "getControlPlaneSessionInfo",
            "logoutOfControlPlane",
            "getTerminalContents",
            "showToast",
        )

        // Note: If updating these values, make a corresponding update in
        // core/protocol/passThrough.ts
        val PASS_THROUGH_TO_WEBVIEW = listOf(
            "configUpdate",
            "getDefaultModelTitle",
            "indexProgress", // Codebase
            "indexing/statusUpdate", // Docs, etc.
            "addContextItem",
            "refreshSubmenuItems",
            "isContinueInputFocused",
            "didChangeAvailableProfiles",
            "setTTSActive",
            "getWebviewHistoryLength",
            "getCurrentSessionId",
            "signInToControlPlane",
            "openDialogMessage",
            "docs/suggestions",
        )

        // Note: If updating these values, make a corresponding update in
        // core/protocol/passThrough.ts
        val PASS_THROUGH_TO_CORE = listOf(
            "abort",
            "history/list",
            "history/delete",
            "history/load",
            "history/save",
            "devdata/log",
            "config/addModel",
            "config/newPromptFile",
            "config/ideSettingsUpdate",
            "config/getSerializedProfileInfo",
            "config/deleteModel",
            "config/listProfiles",
            "config/openProfile",
            "context/getContextItems",
            "context/getSymbolsForFiles",
            "context/loadSubmenuItems",
            "context/addDocs",
            "context/removeDocs",
            "context/indexDocs",
            "autocomplete/complete",
            "autocomplete/cancel",
            "autocomplete/accept",
            "command/run",
            "tts/kill",
            "llm/complete",
            "llm/streamComplete",
            "llm/streamChat",
            "llm/listModels",
            "streamDiffLines",
            "chatDescriber/describe",
            "stats/getTokensPerDay",
            "stats/getTokensPerModel",
            // Codebase
            "index/setPaused",
            "index/forceReIndex",
            "index/forceReIndexFiles",
            "index/indexingProgressBarInitialized",
            // Docs, etc.
            "indexing/reindex",
            "indexing/abort",
            "indexing/setPaused",
            "docs/getSuggestedDocs",
            "docs/initStatuses",
            //
            "completeOnboarding",
            "addAutocompleteModel",
            "profiles/switch",
            "didChangeSelectedProfile",
            "tools/call",
        )
    }
}