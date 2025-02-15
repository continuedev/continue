package com.github.continuedev.continueintellijextension.constants

class MessageTypes {
    companion object {
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
            "getFileStats",
            "insertAtCursor",
            "applyToFile",
            "getGitHubAuthToken",
            "setGitHubAuthToken",
            "getControlPlaneSessionInfo",
            "logoutOfControlPlane",
            "getTerminalContents",
            "showToast",
            "openUrl",
            
            // These only come from the GUI for now but should be here to prevent confusion
            "toggleDevTools",
            "showTutorial",
            
            // These are jetbrains only and only come from the GUI for now
            // But again including for consistency
            "copyText",
            "jetbrains/isOSREnabled",
            "jetbrains/getColors",
            "jetbrains/onLoad"
        )

        // Note: If updating these values, make a corresponding update in
        // core/protocol/passThrough.ts
        val PASS_THROUGH_TO_WEBVIEW = listOf(
            "configError",
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
            "config/addContextProvider",
            "config/newPromptFile",
            "config/ideSettingsUpdate",
            "config/getSerializedProfileInfo",
            "config/deleteModel",
            "config/listProfiles",
            "config/openProfile",
            "config/updateSharedConfig",
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
            "docs/getDetails",
            //
            "completeOnboarding",
            "addAutocompleteModel",
            "didChangeSelectedProfile",
            "didChangeSelectedOrg",
            "tools/call",
            "controlPlane/openUrl",
            "controlPlane/listOrganizations"

        )
    }
}