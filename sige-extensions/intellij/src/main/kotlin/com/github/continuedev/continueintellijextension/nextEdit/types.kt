package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.RangeInFile

//data class NextEditOutcome(
//    val completion: String,
//    val diffLines: List<DiffLine>,
//    val editableRegionStartLine: Int,
//    val editableRegionEndLine: Int,
//    val oldCode: String,
//    val newCode: String
//)

data class DiffLine(
    val type: String, // "old", "new", "same"
    val line: String
)

data class NextEditOutcome(
    // Fields from TabAutocompleteOptions
    val disable: Boolean,
    val maxPromptTokens: Int,
    val debounceDelay: Int,
    val maxSuffixPercentage: Int,
    val prefixPercentage: Int,
    val transform: Boolean?,
    val template: String?,
    val multilineCompletions: String, // "always" | "never" | "auto"
    val slidingWindowPrefixPercentage: Int,
    val slidingWindowSize: Int,
    val useCache: Boolean,
    val onlyMyCode: Boolean,
    val useRecentlyEdited: Boolean,
    val disableInFiles: List<String>?,
    val useImports: Boolean?,
    val showWhateverWeHaveAtXMs: Int?,

    // Originally from Autocomplete (commented fields would be nullable if needed)
    val elapsed: Long,
    val modelProvider: String,
    val modelName: String,
    val completionOptions: Any, // Using Any since TypeScript uses 'any'
    val completionId: String,
    val gitRepo: String?,
    val uniqueId: String,
    val timestamp: Long,

    // New for Next Edit
    val fileUri: String,
    val workspaceDirUri: String,
    val prompt: String,
    val userEdits: String,
    val userExcerpts: String,
    val originalEditableRange: String,
    val completion: String,
    val cursorPosition: Position,
    val finalCursorPosition: Position,
    val accepted: Boolean?,
    val editableRegionStartLine: Int,
    val editableRegionEndLine: Int,
    val diffLines: List<DiffLine>
)

enum class DiffLineType {
    NEW,
    OLD,
    SAME
}

data class ProcessedItem(
    val location: RangeInFile,
    val outcome: NextEditOutcome
)