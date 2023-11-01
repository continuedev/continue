package com.github.continuedev.continueintellijextension.listeners

import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.utils.Debouncer
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.vfs.VirtualFile
import kotlinx.coroutines.CoroutineScope

class ContinuePluginSelectionListener(
    private val ideProtocolClient: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) : SelectionListener, DumbAware {
    private val debouncer = Debouncer(100L, coroutineScope)
    override fun selectionChanged(e: SelectionEvent) {
        debouncer.debounce { handleSelection(e) }
    }

    private fun handleSelection(e: SelectionEvent) {
        ApplicationManager.getApplication().runReadAction {
            val editor = e.editor
            val model: SelectionModel = editor.selectionModel
            val selectedText = model.selectedText ?: return@runReadAction

            val document = editor.document
            val startOffset = model.selectionStart
            val endOffset = model.selectionEnd
            val startLine = document.getLineNumber(startOffset)
            val endLine = document.getLineNumber(endOffset)
            val startCharacter =
                startOffset - document.getLineStartOffset(startLine)
            val endCharacter = endOffset - document.getLineStartOffset(endLine)

            val virtualFile: VirtualFile? =
                FileDocumentManager.getInstance().getFile(document)
            val filepath = virtualFile?.path ?: "Unknown path"

            ideProtocolClient.onTextSelected(
                selectedText,
                filepath,
                startLine,
                startCharacter,
                endLine,
                endCharacter
            )
        }
    }
}





