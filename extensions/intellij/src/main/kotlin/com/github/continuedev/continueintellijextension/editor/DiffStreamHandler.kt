package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.command.undo.UndoManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import kotlin.math.min


enum class DiffLineType {
    SAME, NEW, OLD
}

class DiffStreamHandler(
    private val project: Project,
    private val editor: Editor,
    private val startLine: Int,
    private val endLine: Int,
    private val onClose: () -> Unit,
    private val onFinish: () -> Unit
) {
    private data class CurLineState(
        var index: Int, var highlighter: RangeHighlighter? = null, var diffBlock: VerticalDiffBlock? = null
    )

    private var curLine = CurLineState(startLine)

    private var isRunning: Boolean = false
    private var hasAcceptedOrRejectedBlock: Boolean = false

    private val unfinishedHighlighters: MutableList<RangeHighlighter> = mutableListOf()
    private val diffBlocks: MutableList<VerticalDiffBlock> = mutableListOf()

    private val curLineKey = createTextAttributesKey("CONTINUE_DIFF_CURRENT_LINE", 0x40888888, editor)
    private val unfinishedKey = createTextAttributesKey("CONTINUE_DIFF_UNFINISHED_LINE", 0x20888888, editor)

    init {
        initUnfinishedRangeHighlights()
    }

    fun acceptAll() {
        editor.markupModel.removeAllHighlighters()
        resetState()
    }

    fun rejectAll() {
        // The ideal action here is to undo all changes we made to return the user's edit buffer to the state prior
        // to our changes. However, if the user has accepted or rejected one or more diff blocks, there isn't a simple
        // way to undo our changes without also undoing the diff that the user accepted or rejected.
        if (hasAcceptedOrRejectedBlock) {
            diffBlocks.forEach { it.handleReject() }
        } else {
            undoChanges()
        }

        resetState()
    }

    fun streamDiffLinesToEditor(
        input: String, prefix: String, highlighted: String, suffix: String, modelTitle: String
    ) {
        isRunning = true

        val continuePluginService = ServiceManager.getService(project, ContinuePluginService::class.java)
        val virtualFile = getVirtualFile()

        continuePluginService.coreMessenger?.request(
            "streamDiffLines", createRequestParams(input, prefix, highlighted, suffix, virtualFile, modelTitle), null
        ) { response ->
            if (!isRunning) return@request

            val parsed = response as Map<*, *>

            if (response["done"] as? Boolean == true) {
                handleFinishedResponse()
                return@request
            }

            handleDiffLineResponse(parsed)
        }
    }

    private fun initUnfinishedRangeHighlights() {
        for (i in startLine..endLine) {
            val highlighter = editor.markupModel.addLineHighlighter(
                unfinishedKey, min(
                    i, editor.document.lineCount - 1
                ), HighlighterLayer.LAST
            )
            unfinishedHighlighters.add(highlighter)
        }
    }

    private fun handleDiffLine(type: DiffLineType, text: String) {
        try {
            when (type) {
                DiffLineType.SAME -> handleSameLine()
                DiffLineType.NEW -> handleNewLine(text)
                DiffLineType.OLD -> handleOldLine()
            }

            updateProgressHighlighters(type)

            // Since we only call onLastDiffLine() when we reach a "same" line, we need to handle the case where
            // we reach EOF while in a diff block, since we won't encounter a "same" line.
            if (curLine.index >= editor.document.lineCount - 1) {
                curLine.diffBlock?.onLastDiffLine()
            }
        } catch (e: Exception) {
            println("Error handling diff line: ${curLine.index}, $type, $text, ${e.message}")
        }
    }

    private fun handleDiffBlockAcceptOrReject(diffBlock: VerticalDiffBlock, didAccept: Boolean) {
        hasAcceptedOrRejectedBlock = true

        diffBlocks.remove(diffBlock)

        if (!didAccept) {
            updatePositionsOnReject(diffBlock.startLine, diffBlock.addedLines.size, diffBlock.deletedLines.size)
        }

        if (diffBlocks.isEmpty()) {
            onClose()
        }
    }


    private fun createDiffBlock(): VerticalDiffBlock {
        val diffBlock = VerticalDiffBlock(
            editor, project, curLine.index, ::handleDiffBlockAcceptOrReject
        )
        
        diffBlocks.add(diffBlock)

        return diffBlock
    }

    private fun handleSameLine() {
        if (curLine.diffBlock != null) {
            curLine.diffBlock!!.onLastDiffLine()
        }

        curLine.diffBlock = null

        curLine.index++
    }

    private fun handleNewLine(text: String) {
        if (curLine.diffBlock == null) {
            curLine.diffBlock = createDiffBlock()
        }

        curLine.diffBlock!!.addNewLine(text, curLine.index)

        curLine.index++
    }

    private fun handleOldLine() {
        if (curLine.diffBlock == null) {
            curLine.diffBlock = createDiffBlock()
        }

        curLine.diffBlock!!.deleteLineAt(curLine.index)
    }

    private fun updateProgressHighlighters(type: DiffLineType) {
        // Update the highlighter to show the current line
        curLine.highlighter?.let { editor.markupModel.removeHighlighter(it) }
        curLine.highlighter = editor.markupModel.addLineHighlighter(
            curLineKey, min(curLine.index, editor.document.lineCount - 1), HighlighterLayer.LAST
        )

        // Remove the unfinished lines highlighter
        if (type != DiffLineType.OLD && unfinishedHighlighters.isNotEmpty()) {
            editor.markupModel.removeHighlighter(unfinishedHighlighters.removeAt(0))
        }
    }


    private fun updatePositionsOnReject(startLine: Int, numAdditions: Int, numDeletions: Int) {
        val offset = -numAdditions + numDeletions

        diffBlocks.forEach { block ->
            if (block.startLine > startLine) {
                block.updatePosition(block.startLine + offset)
            }
        }
    }

    private fun resetState() {
        // Clear the editor of highlighting/inlays
        editor.markupModel.removeAllHighlighters()
        diffBlocks.forEach { it.clearEditorUI() }

        // Clear state vars
        diffBlocks.clear()
        curLine = CurLineState(startLine)
        isRunning = false

        // Close the Edit input
        onClose()
    }


    private fun undoChanges() {
        WriteCommandAction.runWriteCommandAction(project) {
            val undoManager = UndoManager.getInstance(project)
            val virtualFile = getVirtualFile() ?: return@runWriteCommandAction
            val fileEditor = FileEditorManager.getInstance(project).getSelectedEditor(virtualFile) as TextEditor

            if (undoManager.isUndoAvailable(fileEditor)) {
                val numChanges = diffBlocks.sumOf { it.deletedLines.size + it.addedLines.size }

                repeat(numChanges) {
                    undoManager.undo(fileEditor)
                }
            }
        }
    }

    private fun getVirtualFile(): VirtualFile? {
        return FileDocumentManager.getInstance().getFile(editor.document) ?: return null
    }

    private fun createRequestParams(
        input: String,
        prefix: String,
        highlighted: String,
        suffix: String,
        virtualFile: VirtualFile?,
        modelTitle: String
    ): Map<String, Any?> {
        return mapOf(
            "input" to input,
            "prefix" to prefix,
            "highlighted" to highlighted,
            "suffix" to suffix,
            "language" to virtualFile?.fileType?.name,
            "modelTitle" to modelTitle
        )
    }

    private fun handleFinishedResponse() {
        onFinish()

        ApplicationManager.getApplication().invokeLater {
            cleanupProgressHighlighters()
        }
    }

    private fun cleanupProgressHighlighters() {
        curLine.highlighter?.let { editor.markupModel.removeHighlighter(it) }
        unfinishedHighlighters.forEach { editor.markupModel.removeHighlighter(it) }
    }


    private fun handleDiffLineResponse(parsed: Map<*, *>) {
        val data = parsed["content"] as Map<*, *>
        val diffLineType = getDiffLineType(data["type"] as String)

        WriteCommandAction.runWriteCommandAction(project) {
            handleDiffLine(diffLineType, data["line"] as String)
        }
    }

    private fun getDiffLineType(type: String): DiffLineType {
        return when (type) {
            "same" -> DiffLineType.SAME
            "new" -> DiffLineType.NEW
            "old" -> DiffLineType.OLD
            else -> throw Exception("Unknown diff line type: $type")
        }
    }
}