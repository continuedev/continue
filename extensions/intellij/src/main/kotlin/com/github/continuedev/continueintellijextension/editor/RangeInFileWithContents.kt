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
    val contents: String
) {
    /**
     * Returns the absolute document offset for the start position
     */
    fun getStartOffset(document: Document): Int {
        return document.getLineStartOffset(range.start.line) + range.start.character
    }

    /**
     * Returns the absolute document offset for the end position
     */
    fun getEndOffset(document: Document): Int {
        return document.getLineStartOffset(range.end.line) + range.end.character
    }


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

            val selectedText = document.getText(
                TextRange(selectionStart, selectionEnd)
            )

            return RangeInFileWithContents(
                filepath,
                Range(
                    Position(startLine, startChar),
                    Position(endLine, endChar)
                ),
                selectedText
            )
        }
    }
}