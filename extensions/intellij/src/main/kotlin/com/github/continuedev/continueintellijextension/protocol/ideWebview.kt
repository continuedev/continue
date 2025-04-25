package com.github.continuedev.continueintellijextension.protocol

data class CopyTextParams(
    val text: String
)

data class SetGitHubAuthTokenParams(
    val token: String
)

data class ApplyToFileParams(
    val text: String,
    val streamId: String,
    val filepath: String?,
    val toolCallId: String?
)

data class AcceptDiffParams(
    val filepath: String,
    val streamId: String
)

data class RejectDiffParams(
    val filepath: String,
    val streamId: String
)

data class InsertAtCursorParams(
    val text: String
)

