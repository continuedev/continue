package com.github.continuedev.continueintellijextension.listeners

import ToolTipComponent
import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.utils.Debouncer
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.vfs.VirtualFile
import kotlinx.coroutines.CoroutineScope
import kotlin.math.max
import kotlin.math.min

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

            // Allow user to disable editor tooltip
            // Note that we still check for empty selected text before this
            val extensionSettingsService = service<ContinueExtensionSettings>()
            if (extensionSettingsService.continueState.displayEditorTooltip == false) {
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

                editor.contentComponent.layout = null

                val line = startLine - 2
                if (line > 0) {
                    // Get the text on line number "line"
//                    val text = document.getText(document.getLineStartOffset(line), document.getLineEndOffset(line))

                    val pos = LogicalPosition(line, selectedText.split("\n")[0].length + 1)
                    val y: Int = editor.logicalPositionToXY(pos).y + editor.lineHeight
                    var x: Int = editor.logicalPositionToXY(pos).x

                    // Check if x is out of bounds
                    val maxEditorWidth = editor.contentComponent.width
                    val maxToolTipWidth = 600
                    x = max(0, min(x, maxEditorWidth - maxToolTipWidth))

                    toolTipComponent = ToolTipComponent(editor, x, y)
                    editor.contentComponent.add(toolTipComponent)
                } else {
                    toolTipComponent = null
                }

                editor.contentComponent.revalidate()
                editor.contentComponent.repaint()
            }
        }
    }
}





