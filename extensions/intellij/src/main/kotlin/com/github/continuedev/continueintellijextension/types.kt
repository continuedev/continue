package com.github.continuedev.continueintellijextension

import com.github.continuedev.continueintellijextension.editor.RangeInFileWithContents
import com.google.gson.JsonElement

enum class ToastType(val value: String) {
    INFO("info"),
    ERROR("error"),
    WARNING("warning"),
}

enum class FileType(val value: Int) {
    UNKNOWN(0),
    FILE(1),
    DIRECTORY(2),
    SYMBOLIC_LINK(64)
}

data class Position(val line: Int, val character: Int)

data class Range(val start: Position, val end: Position)

data class IdeInfo(
    val ideType: String,
    val name: String,
    val version: String,
    val remoteName: String,
    val extensionVersion: String,
    val isPrerelease: Boolean
)

data class Problem(
    val filepath: String,
    val range: Range,
    val message: String
)

data class Thread(val name: String, val id: Int)

data class IndexTag(
    val artifactId: String,
    val branch: String,
    val directory: String
)

data class Location(
    val filepath: String,
    val position: Position
)

data class RangeInFile(
    val filepath: String,
    val range: Range
)

data class RangeInFileWithContents(
    val filepath: String,
    val range: Range,
    val contents: String
)

/**
 * Signature help represents the signature of something
 * callable. There can be multiple signatures but only one
 * active and only one active parameter.
 */
data class SignatureHelp(
    /**
     * One or more signatures.
     */
    val signatures: List<SignatureInformation>,

    /**
     * The active signature.
     */
    val activeSignature: Int,

    /**
     * The active parameter of the active signature.
     */
    val activeParameter: Int
)

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
data class SignatureInformation(
    /**
     * The label of this signature. Will be shown in
     * the UI.
     */
    val label: String,

    /**
     * The parameters of this signature.
     */
    val parameters: List<ParameterInformation>,

    /**
     * The index of the active parameter.
     *
     * If provided, this is used in place of [SignatureHelp.activeParameter].
     */
    val activeParameter: Int? = null
)

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
data class ParameterInformation(
    /**
     * The label of this signature.
     *
     * Either a string or inclusive start and exclusive end offsets within its containing
     * [SignatureInformation.label] signature label. *Note*: A label of type string must be
     * a substring of its containing signature information's [SignatureInformation.label] label.
     */
    val label: String // Note: Kotlin doesn't have union types, so this represents the string case
)

data class DocumentSymbol(
    val name: String,
    val kind: String,
    val range: Range,
    val selectionRange: Range
)

data class ControlPlaneSessionInfo(
    val accessToken: String,
    val account: Account
)

data class Account(
    val label: String,
    val id: String
)

data class FileStats(
    val lastModified: Long,
    val size: Long
)

data class IdeSettings(
    val remoteConfigServerUrl: String?,
    val remoteConfigSyncPeriod: Int,
    val userToken: String,
    val pauseCodebaseIndexOnStart: Boolean,
    val continueTestEnvironment: String
)

data class TerminalOptions(
    val reuseTerminal: Boolean?,
    val terminalName: String?,
    val waitForCompletion: Boolean?
)

interface IDE {
    suspend fun getIdeInfo(): IdeInfo

    suspend fun getIdeSettings(): IdeSettings

    suspend fun getDiff(includeUnstaged: Boolean): List<String>

    suspend fun getClipboardContent(): Map<String, String>

    suspend fun isWorkspaceRemote(): Boolean

    suspend fun getUniqueId(): String

    suspend fun getTerminalContents(): String

    suspend fun getDebugLocals(threadIndex: Int): String

    suspend fun getTopLevelCallStackSources(
        threadIndex: Int,
        stackDepth: Int
    ): List<String>

    suspend fun getAvailableThreads(): List<Thread>

    suspend fun getWorkspaceDirs(): List<String>

    suspend fun fileExists(filepath: String): Boolean

    suspend fun writeFile(path: String, contents: String)

    suspend fun removeFile(path: String)

    suspend fun showVirtualFile(title: String, contents: String)

    suspend fun getContinueDir(): String

    suspend fun openFile(path: String)

    suspend fun openUrl(url: String)

    suspend fun runCommand(command: String, options: TerminalOptions?)

    suspend fun saveFile(filepath: String)

    suspend fun readFile(filepath: String): String

    suspend fun readRangeInFile(filepath: String, range: Range): String

    suspend fun showLines(
        filepath: String,
        startLine: Int,
        endLine: Int
    )

    suspend fun showDiff(
        filepath: String,
        newContents: String,
        stepIndex: Int
    )

    suspend fun getOpenFiles(): List<String>

    suspend fun getCurrentFile(): Map<String, Any>?

    suspend fun getPinnedFiles(): List<String>

    suspend fun getSearchResults(query: String, maxResults: Int?): String

    suspend fun getFileResults(pattern: String, maxResults: Int?): List<String>

    // Note: This should be a `Pair<String, String>` but we use `List<Any>` because the keys of `Pair`
    // will serialize to `first and `second` rather than `0` and `1` like in JavaScript
    suspend fun subprocess(command: String, cwd: String? = null): List<Any>

    suspend fun getProblems(filepath: String? = null): List<Problem>

    suspend fun getBranch(dir: String): String

    suspend fun getTags(artifactId: String): List<IndexTag>

    suspend fun getRepoName(dir: String): String?

    suspend fun showToast(
        type: ToastType,
        message: String,
        vararg otherParams: Any
    ): Any

    suspend fun getGitRootPath(dir: String): String?

    // Note: This should be a `List<Pair<String, FileType>>` but we use `List<Any>` because the keys of `Pair`
    // will serialize to `first and `second` rather than `0` and `1` like in JavaScript
    suspend fun listDir(dir: String): List<List<Any>>

    suspend fun getFileStats(files: List<String>): Map<String, FileStats>

    // LSP
    suspend fun gotoDefinition(location: Location): List<RangeInFile>
    suspend fun gotoTypeDefinition(location: Location): List<RangeInFile>
    suspend fun getSignatureHelp(location: Location): SignatureHelp?
    suspend fun getReferences(location: Location): List<RangeInFile>
    suspend fun getDocumentSymbols(textDocumentIdentifier: String): List<DocumentSymbol>

    // Callbacks
    fun onDidChangeActiveTextEditor(callback: (filepath: String) -> Unit)
}

data class Message(
    val messageType: String,
    val messageId: String,
    val data: JsonElement
)

// TODO: Needs to be updated to handle new "apply" logic
data class AcceptRejectDiff(val accepted: Boolean, val stepIndex: Int)

data class DeleteAtIndex(val index: Int)

enum class ApplyStateStatus(val status: String) {
    NOT_STARTED("not-started"),
    STREAMING("streaming"),
    DONE("done"),
    CLOSED("closed");
}

data class ApplyState(
    val streamId: String,
    val status: String,
    val numDiffs: Int? = null,
    val filepath: String? = null,
    val fileContent: String? = null,
    val originalFileContent: String? = null,
    val toolCallId: String? = null
)

data class HighlightedCodePayload(
    val rangeInFileWithContents: com.github.continuedev.continueintellijextension.RangeInFileWithContents,
    val prompt: String? = null,
    val shouldRun: Boolean? = null
)

data class StreamDiffLinesPayload(
    val prefix: String,
    val highlighted: String,
    val suffix: String,
    val input: String,
    val language: String?,
    val modelTitle: String?,
    val includeRulesInSystemMessage: Boolean,
    val fileUri: String?,
    val isApply: Boolean
)

data class GetDiffLinesPayload(
    val oldContent: String,
    val newContent: String,
)

data class AcceptOrRejectDiffPayload(
    val filepath: String? = null,
    val streamId: String? = null
)

data class ShowFilePayload(
    val filepath: String
)

sealed class FimResult {
    data class FimEdit(val fimText: String) : FimResult()
    object NotFimEdit : FimResult()
}
