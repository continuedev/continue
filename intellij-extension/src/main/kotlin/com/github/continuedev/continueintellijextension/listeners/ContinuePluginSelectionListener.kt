package com.github.continuedev.continueintellijextension.listeners

import com.github.continuedev.continueintellijextension.`continue`.TextSelectionStrategy
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import java.nio.file.Paths

class ContinuePluginSelectionListener(private val strategy: TextSelectionStrategy) : SelectionListener {
    override fun selectionChanged(e: SelectionEvent) {
        val editor = e.editor
        val model: SelectionModel = editor.selectionModel

        model.let { model ->
            val document = editor.document
            val startOffset = model.selectionStart
            val endOffset = model.selectionEnd

            val startLine = document.getLineNumber(startOffset)
            val endLine = document.getLineNumber(endOffset)
            val startCharacter = startOffset - document.getLineStartOffset(startLine)
            val endCharacter = endOffset - document.getLineStartOffset(endLine)

            val filepath = editor.document.toString().drop(20).dropLast(1);
            model.selectedText?.let { text ->
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
}





