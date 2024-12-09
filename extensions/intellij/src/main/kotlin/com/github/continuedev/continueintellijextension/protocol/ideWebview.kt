package com.github.continuedev.continueintellijextension.protocol

import com.github.continuedev.continueintellijextension.`continue`.RangeInFileWithContents

// Base message types
data class OnLoadParams(
    val windowId: String,
    val serverUrl: String,
    val workspacePaths: List<String>,
    val vscMachineId: String,
    val vscMediaUrl: String
)

data class ApplyToFileParams(
    val text: String,
    val streamId: String,
    val curSelectedModelTitle: String,
    val filepath: String?
)

data class OverwriteFileParams(
    val filepath: String,
    val prevFileContent: String?
)

data class ShowFileParams(
    val filepath: String
)

data class ToggleFullScreenParams(
    val newWindow: Boolean?
)

data class InsertAtCursorParams(
    val text: String
)

data class CopyTextParams(
    val text: String
)

data class EditorInsetHeightParams(
    val height: Int
)

data class SetGitHubAuthTokenParams(
    val token: String
)

data class AcceptDiffParams(
    val filepath: String,
    val streamId: String?
)

data class RejectDiffParams(
    val filepath: String,
    val streamId: String?
)

data class EditSendPromptParams(
    val prompt: MessageContent,
    val range: RangeInFileWithContents
)

data class EditAcceptRejectParams(
    val accept: Boolean,
    val onlyFirst: Boolean,
    val filepath: String
)

data class EditExitParams(
    val shouldFocusEditor: Boolean
)

// For ToWebviewFromIdeProtocol
data class SubmitMessageParams(
    val message: Any  // Consider creating a more specific type for JSONContent
)

data class UpdateSubmenuItemsParams(
    val provider: String,
    val submenuItems: List<ContextSubmenuItem>
)

data class NewSessionWithPromptParams(
    val prompt: String
)

data class UserInputParams(
    val input: String
)

data class HighlightedCodeParams(
    val rangeInFileWithContents: RangeInFileWithContents,
    val prompt: String?,
    val shouldRun: Boolean?
)

data class NavigateToParams(
    val path: String,
    val toggle: Boolean?
)

data class FocusContinueSessionIdParams(
    val sessionId: String?
)

data class SetThemeParams(
    val theme: Any  // Consider creating a more specific type
)

data class SetColorsParams(
    val colors: Map<String, String>
)

data class SetEditStatusParams(
    val status: EditStatus,
    val fileAfterEdit: String?
)