package com.github.continuedev.continueintellijextension.listeners

import ToolTipComponent
import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.editor.EditorUtils
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.utils.Debouncer
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.util.TextRange
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

    private var toolTipComponents: ArrayList<ToolTipComponent> = ArrayList()

    private fun removeExistingTooltips(editor: Editor, onComplete: () -> Unit = {}) {
        ApplicationManager.getApplication().invokeLater {
            toolTipComponents.forEach {
                editor.contentComponent.remove(it)
            }
            editor.contentComponent.revalidate()
            editor.contentComponent.repaint()
            toolTipComponents.clear()
            onComplete()
        }
    }

    private fun handleSelection(e: SelectionEvent) {
        ApplicationManager.getApplication().runReadAction {
            val editor = e.editor
            val model: SelectionModel = editor.selectionModel
            val selectedText = model.selectedText

            // If selected text is empty, remove the tooltip
            if (selectedText.isNullOrEmpty()) {
                removeExistingTooltips(editor)
                return@runReadAction
            }

            // Allow user to disable editor tooltip
            // Note that we still check for empty selected text before this
            val extensionSettingsService = service<ContinueExtensionSettings>()
            if (extensionSettingsService.continueState.displayEditorTooltip == false) {
                return@runReadAction
            }

            // Don't display in the terminal
            if (EditorUtils().isTerminal(editor)) {
                return@runReadAction
            }

            val document = editor.document
            val startOffset = model.selectionStart
            val endOffset = model.selectionEnd
            val startLine = document.getLineNumber(startOffset)
            val endLine = document.getLineNumber(endOffset)
            val virtualFile: VirtualFile? =
                FileDocumentManager.getInstance().getFile(document)


            removeExistingTooltips(editor) {
                ApplicationManager.getApplication().invokeLater {
                    editor.contentComponent.layout = null

                    var topLine = startLine
                    var hasText = false
                    
                    for (line in startLine until endLine) {
                        val lineStartOffset = document.getLineStartOffset(line)
                        val lineEndOffset = document.getLineEndOffset(line)
                        val lineText = document.getText(TextRange(lineStartOffset, lineEndOffset)).trim()
                        if (lineText.isNotEmpty()) {
                            topLine = line
                            hasText = true
                            break
                        }
                    }

                    if (hasText && topLine < endLine) {
                        // Get the text on the top line
                        val lineStartOffset = document.getLineStartOffset(topLine)
                        val lineEndOffset = document.getLineEndOffset(topLine)
                        val lineText = document.getText(TextRange(lineStartOffset, lineEndOffset))

                        // Calculate the position 20px to the right of the end of the line
                        val endOfLinePos = LogicalPosition(topLine, lineText.length)
                        val endOfLineX = editor.logicalPositionToXY(endOfLinePos).x
                        val tooltipX = endOfLineX + 40

                        // Calculate the Y position (vertically centered on the line)
                        val lineTopY = editor.logicalPositionToXY(LogicalPosition(topLine, 0)).y
                        val lineHeight = editor.lineHeight
                        val y = lineTopY + (lineHeight / 2)

                        // Check if x is out of bounds
                        val maxEditorWidth = editor.contentComponent.width
                        val maxToolTipWidth = 600
                        val x = max(0, min(tooltipX, maxEditorWidth - maxToolTipWidth))

                        val toolTipComponent = ToolTipComponent(editor, x, y)
                        toolTipComponents.add(toolTipComponent)
                        editor.contentComponent.add(toolTipComponent)
                    }

                    editor.contentComponent.revalidate()
                    editor.contentComponent.repaint()
                }
            }
        }
    }
}





