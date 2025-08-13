package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.`continue`.CoreMessenger
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.project.Project
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.time.Duration.Companion.milliseconds

interface NextEditService {
    suspend fun getNextEditSuggestion(
        completionId: String,
        filepath: String,
        line: Int,
        character: Int,
        withChain: Boolean = false,
        usingFullFileDiff: Boolean = true
    ): NextEditOutcome?
    fun startChain()
    fun deleteChain()
    fun chainExists(): Boolean
    fun getNextInChain(): NextEditItem?
    fun markDisplayed(completionId: String, outcome: NextEditOutcome)
    fun acceptEdit(completionId: String)
    fun rejectEdit(completionId: String)
}

@Service(Service.Level.PROJECT)
class ContinueNextEditService(private val project: Project) : NextEditService {

    private var currentChain: NextEditChain? = null
    private val displayedCompletions = mutableMapOf<String, NextEditOutcome>()

    private val coreMessenger: CoreMessenger?
        get() = project.service<ContinuePluginService>().coreMessenger

    override suspend fun getNextEditSuggestion(
        completionId: String,
        filepath: String,
        line: Int,
        character: Int,
        withChain: Boolean,
        usingFullFileDiff: Boolean
    ): NextEditOutcome? {
        val requestData = mapOf(
            "input" to mapOf(
                "completionId" to completionId,
                "filepath" to filepath,
                "pos" to mapOf("line" to line, "character" to character),
                "recentlyEditedRanges" to emptyList<Any>(),
                "recentlyVisitedRanges" to emptyList<Any>()
            ),
            "options" to mapOf(
                "withChain" to withChain,
                "usingFullFileDiff" to usingFullFileDiff
            )
        )

        return withTimeoutOrNull(5000.milliseconds) {
            suspendCancellableCoroutine { continuation ->
                coreMessenger?.request("nextEdit/predict", requestData, null) { response ->
                    val outcome = parseNextEditOutcome(response)
                    continuation.resume(outcome)
                }
            }
        }
    }

    override fun startChain() {
        currentChain = NextEditChain()
        coreMessenger?.request("nextEdit/startChain", emptyMap<String, Any>(), null) {}
    }

    override fun deleteChain() {
        currentChain = null
        coreMessenger?.request("nextEdit/deleteChain", emptyMap<String, Any>(), null) {}
    }

    override fun chainExists(): Boolean = currentChain != null

    override fun getNextInChain(): NextEditItem? {
        return currentChain?.getNext()
    }

    override fun markDisplayed(completionId: String, outcome: NextEditOutcome) {
        displayedCompletions[completionId] = outcome
    }

    override fun acceptEdit(completionId: String) {
        coreMessenger?.request("nextEdit/accept", mapOf("completionId" to completionId), null) {}
        displayedCompletions.remove(completionId)
    }

    override fun rejectEdit(completionId: String) {
        coreMessenger?.request("nextEdit/reject", mapOf("completionId" to completionId), null) {}
        displayedCompletions.remove(completionId)
        deleteChain()
    }

    private fun parseNextEditOutcome(response: Any?): NextEditOutcome? {
        return try {
            val responseMap = response as? Map<String, Any> ?: return null
            val contentMap = responseMap["content"] as? Map<String, Any> ?: return null

            // Extract position data
            val cursorPos = contentMap["cursorPosition"] as? Map<String, Any>
            val cursorPosition = if (cursorPos != null) {
                Position(
                    line = (cursorPos["line"] as? Number)?.toInt() ?: 0,
                    character = (cursorPos["character"] as? Number)?.toInt() ?: 0
                )
            } else {
                Position(0, 0)
            }

            val finalCursorPos = contentMap["finalCursorPosition"] as? Map<String, Any>
            val finalCursorPosition = if (finalCursorPos != null) {
                Position(
                    line = (finalCursorPos["line"] as? Number)?.toInt() ?: 0,
                    character = (finalCursorPos["character"] as? Number)?.toInt() ?: 0
                )
            } else {
                Position(0, 0)
            }

            // Extract diffLines
            val diffLinesRaw = contentMap["diffLines"] as? List<Map<String, Any>> ?: emptyList()
            val diffLines = diffLinesRaw.map { diffLineMap ->
                DiffLine(
                    type = diffLineMap["type"] as? String ?: "same",
                    line = diffLineMap["line"] as? String ?: ""
                )
            }

            // Construct NextEditOutcome from the map data
            NextEditOutcome(
                // TabAutocompleteOptions fields
                disable = contentMap["disable"] as? Boolean ?: false,
                maxPromptTokens = (contentMap["maxPromptTokens"] as? Number)?.toInt() ?: 2048,
                debounceDelay = (contentMap["debounceDelay"] as? Number)?.toInt() ?: 150,
                maxSuffixPercentage = (contentMap["maxSuffixPercentage"] as? Number)?.toInt() ?: 25,
                prefixPercentage = (contentMap["prefixPercentage"] as? Number)?.toInt() ?: 85,
                transform = contentMap["transform"] as? Boolean,
                template = contentMap["template"] as? String,
                multilineCompletions = contentMap["multilineCompletions"] as? String ?: "auto",
                slidingWindowPrefixPercentage = (contentMap["slidingWindowPrefixPercentage"] as? Number)?.toInt() ?: 75,
                slidingWindowSize = (contentMap["slidingWindowSize"] as? Number)?.toInt() ?: 500,
                useCache = contentMap["useCache"] as? Boolean ?: true,
                onlyMyCode = contentMap["onlyMyCode"] as? Boolean ?: true,
                useRecentlyEdited = contentMap["useRecentlyEdited"] as? Boolean ?: true,
                disableInFiles = contentMap["disableInFiles"] as? List<String>,
                useImports = contentMap["useImports"] as? Boolean,
                showWhateverWeHaveAtXMs = (contentMap["showWhateverWeHaveAtXMs"] as? Number)?.toInt(),

                // Autocomplete fields
                elapsed = (contentMap["elapsed"] as? Number)?.toLong() ?: 0L,
                modelProvider = contentMap["modelProvider"] as? String ?: "",
                modelName = contentMap["modelName"] as? String ?: "",
                completionOptions = contentMap["completionOptions"] ?: emptyMap<String, Any>(),
                completionId = contentMap["completionId"] as? String ?: "",
                gitRepo = contentMap["gitRepo"] as? String,
                uniqueId = contentMap["uniqueId"] as? String ?: "",
                timestamp = (contentMap["timestamp"] as? Number)?.toLong() ?: System.currentTimeMillis(),

                // Next Edit specific fields
                fileUri = contentMap["fileUri"] as? String ?: "",
                workspaceDirUri = contentMap["workspaceDirUri"] as? String ?: "",
                prompt = contentMap["prompt"] as? String ?: "",
                userEdits = contentMap["userEdits"] as? String ?: "",
                userExcerpts = contentMap["userExcerpts"] as? String ?: "",
                originalEditableRange = contentMap["originalEditableRange"] as? String ?: "",
                completion = contentMap["completion"] as? String ?: "",
                cursorPosition = cursorPosition,
                finalCursorPosition = finalCursorPosition,
                accepted = contentMap["accepted"] as? Boolean,
                editableRegionStartLine = (contentMap["editableRegionStartLine"] as? Number)?.toInt() ?: 0,
                editableRegionEndLine = (contentMap["editableRegionEndLine"] as? Number)?.toInt() ?: 0,
                diffLines = diffLines
            )
        } catch (e: Exception) {
            println("Error parsing Next Edit outcome: ${e.message}")
            null
        }
    }
}

data class NextEditChain(
    private val items: MutableList<NextEditItem> = mutableListOf()
) {
    fun getNext(): NextEditItem? = items.removeFirstOrNull()
    fun add(item: NextEditItem) = items.add(item)
    fun isEmpty(): Boolean = items.isEmpty()
    fun size(): Int = items.size
}

data class NextEditItem(
    val outcome: NextEditOutcome,
    val jumpLocation: LogicalPosition
)