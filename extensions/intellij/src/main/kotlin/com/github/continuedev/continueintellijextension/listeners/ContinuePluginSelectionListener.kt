package com.github.continuedev.continueintellijextension.listeners

import ToolTipComponent
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

    private var toolTipComponent: ToolTipComponent? = null

    private fun handleSelection(e: SelectionEvent) {
        ApplicationManager.getApplication().runReadAction {
            val editor = e.editor
            val model: SelectionModel = editor.selectionModel
            val selectedText = model.selectedText

            // If selected text is empty, remove the tooltip
            if (selectedText.isNullOrEmpty()) {
                ApplicationManager.getApplication().invokeLater {
                    toolTipComponent?.let { editor.contentComponent.remove(it) }
                    toolTipComponent = null
                    editor.contentComponent.revalidate()
                    editor.contentComponent.repaint()
                }
                return@runReadAction
            }

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

            ApplicationManager.getApplication().invokeLater {
                toolTipComponent?.let { editor.contentComponent.remove(it) }
                toolTipComponent = ToolTipComponent(editor, startLine - 2, selectedText.split("\n")[0].length + 1)

                editor.contentComponent.layout = null
                editor.contentComponent.add(toolTipComponent)
                editor.contentComponent.revalidate()
                editor.contentComponent.repaint()
            }
        }
    }
}





