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
            "getFileResults",
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
        )

        // Note: If updating these values, make a corresponding update in
        // core/protocol/passThrough.ts
        val PASS_THROUGH_TO_CORE = listOf(
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
            "index/forceReIndexFiles",
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
        )
    }
}