package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.Range
import com.intellij.openapi.editor.Document
import com.intellij.openapi.util.TextRange

/**
 * Represents a range of text in a file with its contents.
 * Provides utility methods for working with document positions and offsets.
 */
class RangeInFileWithContents(
    val filepath: String,
    val range: Range,
    val contents: String,
    val document: Document

) {
    /**
     * The absolute document offset for the start position
     */
    val startOffset: Int
        get() = document.getLineStartOffset(range.start.line) + range.start.character

    /**
     * The absolute document offset for the end position
     */
    val endOffset: Int
        get() = document.getLineStartOffset(range.end.line) + range.end.character

    /**
     * The line number where the highlighted range starts (zero-based)
     */
    val startLine: Int
        get() = range.start.line

    /**
     * The line number where the highlighted range ends (zero-based)
     * This already accounts for proper line ending calculations.
     */
    val endLine: Int
        get() = range.end.line

    /**
     * Both the start and end line numbers of the highlighted range as a pair
     */
    val lines: Pair<Int, Int>
        get() = Pair(startLine, endLine)

    val offsets: Pair<Int, Int>
        get() = Pair(startOffset, endOffset)

    companion object {
        /**
         * Create a RangeInFileWithContents from a document selection
         */
        fun fromSelection(
            filepath: String,
            document: Document,
            selectionStart: Int,
            selectionEnd: Int
        ): RangeInFileWithContents {
            val startLine = document.getLineNumber(selectionStart)
            val endLine = document.getLineNumber(selectionEnd)

            val startChar = selectionStart - document.getLineStartOffset(startLine)
            val endChar = selectionEnd - document.getLineStartOffset(endLine)

            // Adjust end line if it's a single line selection with trailing newlines
            val adjustedEndLine = if (isSelectionWithTrailingNewline(document, selectionStart, selectionEnd)) {
                endLine - 1
            } else {
                endLine
            }

            val selectedText = document.getText(
                TextRange(selectionStart, selectionEnd)
            )

            return RangeInFileWithContents(
                filepath,
                Range(
                    Position(startLine, startChar),
                    Position(adjustedEndLine, endChar)
                ),
                selectedText,
                document
            )
        }

        /**
         * Checks if the selection spans to the next line only because of trailing newlines.
         * This matters when a user double-clicks to highlight a full line.
         *
         * @return true if the selection is actually a single line selection with trailing newline
         */
        fun isSelectionWithTrailingNewline(
            document: Document,
            selectionStart: Int,
            selectionEnd: Int
        ): Boolean {
            val startLine = document.getLineNumber(selectionStart)
            val endLine = document.getLineNumber(selectionEnd)

            return endLine > startLine &&
                    endLine < document.lineCount &&
                    document.getLineStartOffset(endLine) == selectionEnd
        }
    }
}