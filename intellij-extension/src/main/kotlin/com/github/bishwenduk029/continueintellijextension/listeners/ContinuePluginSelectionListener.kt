package com.github.bishwenduk029.continueintellijextension.listeners

import com.github.bishwenduk029.continueintellijextension.`continue`.TextSelectionStrategy
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import java.nio.file.Paths

private const val HIGHLIGHTED_CODE_FILE_PATH =
    "/Users/kundb/continue-intellij-extension/src/main/resources/continue_code/copiedCode.txt"

class ContinuePluginSelectionListener(private val strategy: TextSelectionStrategy) : SelectionListener {
    override fun selectionChanged(e: SelectionEvent) {
        val editor = e.editor
        val model: SelectionModel = editor.selectionModel

        model.selectedText.let { selectedText ->
            val document = editor.document
            val startOffset = model.selectionStart
            val endOffset = model.selectionEnd

            val startLine = document.getLineNumber(startOffset)
            val endLine = document.getLineNumber(endOffset)
            val startCharacter = startOffset - document.getLineStartOffset(startLine)
            val endCharacter = endOffset - document.getLineStartOffset(endLine)

            val filepath = editor.document.toString()  // Replace with actual filepath if available
            selectedText?.let { text ->
                writeToFile(text)
                strategy.handleTextSelection(
                    text,
                    filepath,
                    startLine,
                    startCharacter,
                    endLine,
                    endCharacter
                )
            }
        }
    }

    private fun writeToFile(content: String) {
        try {
            Paths.get(HIGHLIGHTED_CODE_FILE_PATH).toFile().writeText(content)
        } catch (ex: Exception) {
            ex.printStackTrace()
        }
    }
}





