package com.github.continuedev.continueintellijextension.listeners

import ToolTipComponent
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
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.util.TextRange
import kotlinx.coroutines.CoroutineScope
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.ex.util.EditorUtil
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor

class ContinuePluginSelectionListener(
    coroutineScope: CoroutineScope,
) : SelectionListener, DumbAware {
    private val debouncer = Debouncer(100, coroutineScope)
    private var toolTipComponents: ArrayList<ToolTipComponent> = ArrayList()
    private var lastActiveEditor: Editor? = null

    override fun selectionChanged(e: SelectionEvent) {
        debouncer.debounce { handleSelection(e) }
    }

    private fun removeAllTooltips() {
        ApplicationManager.getApplication().invokeLater {
            toolTipComponents.forEach { tooltip ->
                tooltip.parent?.remove(tooltip)
            }
            toolTipComponents.clear()
        }
    }


    private fun handleSelection(e: SelectionEvent) {
        ApplicationManager.getApplication().runReadAction {
            val editor = e.editor

            if (!isFileEditor(editor)) {
                removeAllTooltips()
                return@runReadAction
            }

            // Fixes a bug where the tooltip isn't being disposed of when opening new files
            if (editor != lastActiveEditor) {
                removeAllTooltips()
                lastActiveEditor = editor
            }

            val model: SelectionModel = editor.selectionModel
            val selectedText = model.selectedText

            if (shouldRemoveTooltip(selectedText, editor)) {
                removeExistingTooltips(editor)
                return@runReadAction
            }

            updateTooltip(editor, model)
        }
    }

    private fun isFileEditor(editor: Editor): Boolean {
        val project = editor.project ?: return false
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)

        // Check if the file exists and is not in-memory only
        if (virtualFile == null || !virtualFile.isInLocalFileSystem) {
            return false
        }

        // Check if the editor is not associated with a console
        val fileEditorManager = FileEditorManager.getInstance(project)
        val fileEditor = fileEditorManager.getSelectedEditor(virtualFile)

        return fileEditor is TextEditor
    }

    private fun shouldRemoveTooltip(selectedText: String?, editor: Editor): Boolean {
        return selectedText.isNullOrEmpty() ||
                !service<ContinueExtensionSettings>().continueState.displayEditorTooltip
    }

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

    private fun updateTooltip(editor: Editor, model: SelectionModel) {
        removeExistingTooltips(editor) {
            ApplicationManager.getApplication().invokeLater {
                val document = editor.document
                val (startLine, endLine, isFullLineSelection) = getSelectionInfo(model, document)
                val selectionTopY = calculateSelectionTopY(editor, startLine, endLine, isFullLineSelection)
                val tooltipX = calculateTooltipX(editor, document, startLine, endLine, isFullLineSelection)

                if (tooltipX != null) {
                    addToolTipComponent(editor, tooltipX, selectionTopY)
                }
            }
        }
    }

    private fun getSelectionInfo(model: SelectionModel, document: Document): Triple<Int, Int, Boolean> {
        val startOffset = model.selectionStart
        val endOffset = model.selectionEnd
        val startLine = document.getLineNumber(startOffset)
        val endLine = document.getLineNumber(endOffset)
        val isFullLineSelection = startOffset == document.getLineStartOffset(startLine) &&
                ((endLine > 0 && endOffset == document.getLineEndOffset(endLine - 1)) || endOffset == document.getLineStartOffset(
                    endLine
                ))

        val adjustedEndLine = if (isFullLineSelection && endLine > startLine) endLine - 1 else endLine

        return Triple(startLine, adjustedEndLine, isFullLineSelection)
    }

    private fun calculateSelectionTopY(
        editor: Editor,
        startLine: Int,
        endLine: Int,
        isFullLineSelection: Boolean
    ): Int {
        return if (startLine == endLine || isFullLineSelection) {
            val lineTopY = editor.logicalPositionToXY(LogicalPosition(startLine, 0)).y
            lineTopY + (editor.lineHeight / 2)
        } else {
            editor.logicalPositionToXY(LogicalPosition(startLine, 0)).y
        }
    }

    private fun calculateTooltipX(
        editor: Editor,
        document: Document,
        startLine: Int,
        endLine: Int,
        isFullLineSelection: Boolean
    ): Int? {
        fun isLineEmpty(lineNumber: Int): Boolean {
            val lineStartOffset = document.getLineStartOffset(lineNumber)
            val lineEndOffset = document.getLineEndOffset(lineNumber)
            return document.getText(TextRange(lineStartOffset, lineEndOffset)).trim().isEmpty()
        }

        fun getLineEndX(lineNumber: Int): Int {
            val lineStartOffset = document.getLineStartOffset(lineNumber)
            val lineEndOffset = document.getLineEndOffset(lineNumber)
            val lineText = document.getText(TextRange(lineStartOffset, lineEndOffset)).trimEnd()
            val endOfLinePos = LogicalPosition(lineNumber, lineText.length)
            return editor.logicalPositionToXY(endOfLinePos).x
        }

        val offset = 40

        // If only one line is selected and it's empty, return null
        if (startLine == endLine && isLineEmpty(startLine) && !isFullLineSelection) {
            return null
        }

        // Find the topmost non-empty line within the selection
        var topNonEmptyLine = startLine
        while (topNonEmptyLine <= endLine && isLineEmpty(topNonEmptyLine)) {
            topNonEmptyLine++
        }

        // If all lines in the selection are empty, return null
        if (topNonEmptyLine > endLine) {
            return null
        }

        // Always display inline if the selection is a single line
        if (isFullLineSelection || startLine == endLine) {
            return getLineEndX(topNonEmptyLine) + offset
        }

        // Check the line above the start of the selection (if it exists)
        val lineAboveSelection = maxOf(0, startLine - 1)

        // Get x-coordinates
        val xCoordTopNonEmpty = getLineEndX(topNonEmptyLine)
        val xCoordLineAbove = getLineEndX(lineAboveSelection)

        // Use the maximum of the two x-coordinates
        val baseXCoord = maxOf(xCoordTopNonEmpty, xCoordLineAbove)

        // Calculate the final x-coordinate
        return baseXCoord + offset
    }

    private fun addToolTipComponent(editor: Editor, tooltipX: Int, selectionTopY: Int) {
        val toolTipComponent = ToolTipComponent(editor, tooltipX, selectionTopY)
        toolTipComponents.add(toolTipComponent)
        editor.contentComponent.add(toolTipComponent)
        editor.contentComponent.revalidate()
        editor.contentComponent.repaint()
    }
}


