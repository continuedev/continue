package com.github.continuedev.continueintellijextension.protocol

import com.github.continuedev.continueintellijextension.*

data class GetControlPlaneSessionInfoParams(val silent: Boolean, val useOnboarding: Boolean)

data class WriteFileParams(
    val path: String,
    val contents: String
)

data class ShowVirtualFileParams(
    val name: String,
    val content: String
)

data class LocalTerminalOptions(
    val preferVisibleTerminal: Boolean?,
    val insertOnly: Boolean?,
    val reuseTerminalNamed: String? 
)

data class WorkspaceTerminalOptions(
    val preferVisibleTerminal: Boolean?,
    val reuseTerminalNamed: String? 
)

data class RipgrepSearchParams(val args: List<String>)

data class RunCommandLocallyParams(val command: String, val options: LocalTerminalOptions?)

data class RunCommandInWorkspaceParams(val command: String, val options: WorkspaceTerminalOptions?)

data class OpenFileParams(val path: String)

typealias OpenUrlParam = String

typealias getTagsParams = String

data class SaveFileParams(val filepath: String)

data class FileExistsParams(val filepath: String)

data class ReadFileParams(val filepath: String)

data class ShowDiffParams(
    val filepath: String,
    val newContents: String,
    val stepIndex: Int
)

data class ShowLinesParams(
    val filepath: String,
    val startLine: Int,
    val endLine: Int
)

data class ReadRangeInFileParams(
    val filepath: String,
    val range: Range
)


data class GetDiffParams(val includeUnstaged: Boolean)

data class GetBranchParams(val dir: String)

data class GetRepoNameParams(val dir: String)

data class GetGitRootPathParams(val dir: String)

data class ListDirParams(val dir: String)

data class GetFileStatsParams(val files: List<String>)