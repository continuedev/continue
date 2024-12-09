package com.github.continuedev.continueintellijextension.protocol

import com.github.continuedev.continueintellijextension.*
import java.lang.Thread

data class GetIdeInfoReturnType(
    val ideType: IdeType,
    val name: String,
    val version: String,
    val remoteName: String,
    val extensionVersion: String
)


data class GetWorkspaceDirsReturnType(val dirs: List<String>)

data class ListFoldersReturnType(val folders: List<String>)

data class WriteFileParams(
    val path: String,
    val contents: String
)


data class ShowVirtualFileParams(
    val name: String,
    val content: String
)


data class GetContinueDirReturnType(val dir: String)

data class OpenFileParams(val path: String)

data class OpenUrlParams(val url: String)

data class RunCommandParams(val command: String)

data class GetSearchResultsParams(val query: String)
data class GetSearchResultsReturnType(val results: String)

data class SubprocessParams(
    val command: String,
    val cwd: String?
)

data class SubprocessReturnType(val output: Pair<String, String>)

data class SaveFileParams(val filepath: String)

data class FileExistsParams(val filepath: String)
data class FileExistsReturnType(val exists: Boolean)

data class ReadFileParams(val filepath: String)
data class ReadFileReturnType(val contents: String)

data class ShowDiffParams(
    val filepath: String,
    val newContents: String,
    val stepIndex: Int
)


data class DiffLineParams(
    val diffLine: DiffLine,
    val filepath: String,
    val startLine: Int,
    val endLine: Int
)


data class GetProblemsParams(val filepath: String)
data class GetProblemsReturnType(val problems: List<Problem>)

data class GetOpenFilesReturnType(val files: List<String>)

data class GetCurrentFileReturnType(
    val isUntitled: Boolean?,
    val path: String?,
    val contents: String?
)

data class GetPinnedFilesReturnType(val files: List<String>)

data class ShowLinesParams(
    val filepath: String,
    val startLine: Int,
    val endLine: Int
)


data class ReadRangeInFileParams(
    val filepath: String,
    val range: Range
)

data class ReadRangeInFileReturnType(val contents: String)

data class GetDiffParams(val includeUnstaged: Boolean)
data class GetDiffReturnType(val diffs: List<String>)

typealias GetWorkspaceConfigsReturnType = List<ContinueRcJson>

data class GetTerminalContentsReturnType(val contents: String)

data class GetDebugLocalsParams(val threadIndex: Int)
data class GetDebugLocalsReturnType(val locals: String)

data class GetTopLevelCallStackSourcesParams(
    val threadIndex: Int,
    val stackDepth: Int
)

data class GetTopLevelCallStackSourcesReturnType(val sources: List<String>)

data class GetAvailableThreadsReturnType(val threads: List<Thread>)

data class IsTelemetryEnabledReturnType(val enabled: Boolean)


typealias GetTagsParams = String

data class GetTagsReturnType(val tags: List<IndexTag>)

data class GetIdeSettingsReturnType(
    val remoteConfigServerUrl: String?,
    val remoteConfigSyncPeriod: Int,
    val userToken: String,
    val enableControlServerBeta: Boolean,
    val pauseCodebaseIndexOnStart: Boolean,
    val enableDebugLogs: Boolean
)

data class GetBranchParams(val dir: String)

data class GetRepoNameParams(val dir: String)

data class ShowToastParams(
    val type: String, // ToastType enum
    val message: String
)


data class GetGitRootPathParams(val dir: String)

data class ListDirParams(val dir: String)
data class ListDirReturnType(val entries: List<Pair<String, Int>>) // Int maps to FileType enum

data class GetLastModifiedParams(val files: List<String>)
data class GetLastModifiedReturnType(val modified: Map<String, Long>)

data class GotoDefinitionParams(val location: Location)
data class GotoDefinitionReturnType(val ranges: List<RangeInFile>)

data class GetGitHubAuthTokenParams(val force: Boolean?)
data class GetGitHubAuthTokenReturnType(val token: String?)

data class GetControlPlaneSessionInfoParams(val silent: Boolean)
data class GetControlPlaneSessionInfoReturnType(val sessionInfo: ControlPlaneSessionInfo?)


data class PathSepReturnType(val sep: String)
