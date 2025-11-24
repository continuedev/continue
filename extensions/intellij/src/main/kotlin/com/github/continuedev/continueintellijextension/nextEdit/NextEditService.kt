package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.`continue`.CoreMessenger
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.codeInsight.inline.completion.InlineCompletionRequest
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
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

    suspend fun handleCase1(
        request: InlineCompletionRequest,
        editor: Editor,
        currCursorPos: Pair<Int, Int>,
        lastUuid: String?
    ): NextEditOutcome?

    suspend fun handleCase2(): NextEditOutcome?
    suspend fun handleCase3(editor: Editor, currentCursorPos: Pair<Int, Int>): NextEditOutcome?
    fun startChain()
    fun deleteChain()
    suspend fun chainExists(): Boolean
    suspend fun getNextInChain(): ProcessedItem?
    fun markDisplayed(completionId: String, outcome: NextEditOutcome)
    fun acceptEdit(completionId: String)
    fun rejectEdit(completionId: String)
}

@Service(Service.Level.PROJECT)
class ContinueNextEditService(private val project: Project) : NextEditService {
    private val displayedCompletions = mutableMapOf<String, NextEditOutcome>()

    private val coreMessenger: CoreMessenger?
        get() = project.service<ContinuePluginService>().coreMessenger

    // Case 1: Typing (chain does not exist).
    override suspend fun handleCase1(
        request: InlineCompletionRequest,
        editor: Editor,
        currCursorPos: Pair<Int, Int>,
        lastUuid: String?
    ): NextEditOutcome? {
        // Start a new chain
        startChain()

        val nextEditOutcome = this.getNextEditSuggestion(
            lastUuid!!,
            editor.virtualFile.url,
            currCursorPos.first,
            currCursorPos.second
        )

        // TODO: Check once and if null, invoke inline completion trigger once more

        return nextEditOutcome
    }

    // Case 2: Jumping (chain exists, jump was taken).
    override suspend fun handleCase2(): NextEditOutcome? {
        val jumpManager = project.service<NextEditJumpManager>()

        // Reset jump state
        jumpManager.setJumpInProgress(false)

        // Use the saved completion from JumpManager instead of making new request
        val savedCompletion = jumpManager.getSavedCompletionAfterJump()
        if (savedCompletion != null) {
            val (_, outcome) = savedCompletion
            jumpManager.clearSavedCompletionAfterJump()
            return outcome
        } else {
            // This technically should not happen according to the TypeScript comment
            return null
        }
    }

    // Case 3: Accepting next edit outcome (chain exists, jump is not taken).
    override suspend fun handleCase3(editor: Editor, currentCursorPos: Pair<Int, Int>): NextEditOutcome? {
        val jumpManager = project.service<NextEditJumpManager>()

        // Try suggesting jump for each location in the chain
        var isJumpSuggested = false

        while (chainExists() && !isJumpSuggested) {
            val nextItemInChain = getNextInChain()
            if (nextItemInChain == null) {
                break
            }

            val nextLocation = nextItemInChain.location
            val outcome = nextItemInChain.outcome

            val currentPosition = LogicalPosition(currentCursorPos.first, currentCursorPos.second)
            val nextPosition = LogicalPosition(nextLocation.range.start.line, nextLocation.range.start.character)

            isJumpSuggested = jumpManager.suggestJump(
                editor,
                currentPosition,
                nextPosition,
                outcome.completion
            )

            if (isJumpSuggested) {
                // Store completion to be rendered after a jump
                jumpManager.setCompletionAfterJump(
                    CompletionDataForAfterJump(
                        completionId = outcome.completionId,
                        outcome = outcome,
                        position = nextPosition
                    )
                )

                // Don't display anything yet.
                // This will be handled in Case 2.
                return null
            }
        }

        if (!isJumpSuggested) {
            deleteChain()
            return null
        }

        return null
    }

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
        // Remove local chain creation
        coreMessenger?.request("nextEdit/startChain", emptyMap<String, Any>(), null) {}
    }

    override fun deleteChain() {
        // Remove local chain deletion
        coreMessenger?.request("nextEdit/deleteChain", emptyMap<String, Any>(), null) {}
    }

    override suspend fun chainExists(): Boolean {
        return suspendCancellableCoroutine { continuation ->
            coreMessenger?.request("nextEdit/isChainAlive", emptyMap<String, Any>(), null) { response ->
                val exists = parseChainExistsResponse(response)
                continuation.resume(exists)
            }
        }
    }

    override suspend fun getNextInChain(): ProcessedItem? {
        return suspendCancellableCoroutine { continuation ->
            coreMessenger?.request("nextEdit/queue/dequeueProcessed", emptyMap<String, Any>(), null) { response ->
                val processedItem = parseProcessedItem(response)
//                val nextEditItem = processedItem?.let { convertToNextEditItem(it) }
                continuation.resume(processedItem)
            }
        }
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
            @Suppress("UNCHECKED_CAST")
            val responseMap = response as? Map<String, Any> ?: return null
            @Suppress("UNCHECKED_CAST")
            val contentMap = responseMap["content"] as? Map<String, Any> ?: return null

            parseNextEditOutcomeFromMap(contentMap)
        } catch (e: Exception) {
            println("Error parsing Next Edit outcome: ${e.message}")
            null
        }
    }

    private fun parseNextEditOutcomeFromMap(contentMap: Map<String, Any>): NextEditOutcome? {
        return try {
            // Extract position data
            @Suppress("UNCHECKED_CAST")
            val cursorPos = contentMap["cursorPosition"] as? Map<String, Any>
            val cursorPosition = if (cursorPos != null) {
                Position(
                    line = (cursorPos["line"] as? Number)?.toInt() ?: 0,
                    character = (cursorPos["character"] as? Number)?.toInt() ?: 0
                )
            } else {
                Position(0, 0)
            }

            @Suppress("UNCHECKED_CAST")
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
            @Suppress("UNCHECKED_CAST")
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
            println("Error parsing NextEditOutcome from map: ${e.message}")
            null
        }
    }

    private fun parseProcessedItem(response: Any?): ProcessedItem? {
        return try {
            @Suppress("UNCHECKED_CAST")
            val responseMap = response as? Map<String, Any> ?: return null
            @Suppress("UNCHECKED_CAST")
            val content = responseMap["content"] as? Map<String, Any> ?: return null

            // Parse location (RangeInFile)
            @Suppress("UNCHECKED_CAST")
            val locationMap = content["location"] as? Map<String, Any> ?: return null
            val filepath = locationMap["filepath"] as? String ?: return null

            @Suppress("UNCHECKED_CAST")
            val rangeMap = locationMap["range"] as? Map<String, Any> ?: return null
            @Suppress("UNCHECKED_CAST")
            val startMap = rangeMap["start"] as? Map<String, Any> ?: return null
            @Suppress("UNCHECKED_CAST")
            val endMap = rangeMap["end"] as? Map<String, Any> ?: return null

            val startPosition = Position(
                line = (startMap["line"] as? Number)?.toInt() ?: 0,
                character = (startMap["character"] as? Number)?.toInt() ?: 0
            )

            val endPosition = Position(
                line = (endMap["line"] as? Number)?.toInt() ?: 0,
                character = (endMap["character"] as? Number)?.toInt() ?: 0
            )

            val range = com.github.continuedev.continueintellijextension.Range(startPosition, endPosition)
            val location = com.github.continuedev.continueintellijextension.RangeInFile(filepath, range)

            // Parse outcome (NextEditOutcome) - reuse existing logic from parseNextEditOutcome
            @Suppress("UNCHECKED_CAST")
            val outcomeData = content["outcome"] as? Map<String, Any> ?: return null
            val outcome = parseNextEditOutcomeFromMap(outcomeData) ?: return null

            ProcessedItem(location, outcome)
        } catch (e: Exception) {
            println("Error parsing ProcessedItem: ${e.message}")
            null
        }
    }

    private fun parseChainExistsResponse(response: Any?): Boolean {
        return try {
            val responseMap = response as? Map<String, Any> ?: return false
            val content = responseMap["content"] ?: return false
            content as? Boolean ?: false
        } catch (e: Exception) {
            println("Error parsing chain exists response: ${e.message}")
            false
        }
    }

    private fun convertToNextEditItem(processedItem: ProcessedItem): NextEditItem {
        // Convert ProcessedItem from core to NextEditItem for JetBrains
        // Implementation depends on ProcessedItem structure
        TODO("Implement conversion from ProcessedItem to NextEditItem")
    }
}


data class NextEditItem(
    val outcome: NextEditOutcome,
    val jumpLocation: LogicalPosition
)