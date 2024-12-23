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
    val curSelectedModelTitle: String,
    val filepath: String?
)

data class InsertAtCursorParams(
    val text: String
)

