package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.ApplyState
import com.github.continuedev.continueintellijextension.ApplyStateStatus
import com.github.continuedev.continueintellijextension.StreamDiffLinesPayload
import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.command.undo.UndoManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
import kotlin.math.max
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
    private val onFinish: () -> Unit,
    private val streamId: String?,
    private val toolCallId: String?
) {
    private data class CurLineState(
        var index: Int, var highlighter: RangeHighlighter? = null, var diffBlock: VerticalDiffBlock? = null
    )

    private val diffBlocks: MutableList<VerticalDiffBlock> = mutableListOf()
    private var curLine = CurLineState(startLine)
    private var isRunning: Boolean = false
    private var hasAcceptedOrRejectedBlock: Boolean = false
    private val unfinishedHighlighters: MutableList<RangeHighlighter> = mutableListOf()
    private val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)


    init {
        initUnfinishedRangeHighlights()
    }

    private fun sendUpdate(status: ApplyStateStatus) {
        if (streamId == null) {
            return
        }

        // Define a single payload and use it for sending
        val payload = ApplyState(
            streamId = streamId,
            status = status.status,
            numDiffs = diffBlocks.size,
            filepath = virtualFile?.url,
            fileContent = "not implemented",
            toolCallId = toolCallId
        )

        project.getBrowser()?.sendToWebview("updateApplyState", payload)
    }

    fun acceptAll() {
        ApplicationManager.getApplication().invokeLater {
            diffBlocks.toList().forEach { it.handleAccept() }
        }
    }

    fun rejectAll() {
        // The ideal action here is to undo all changes we made to return the user's edit buffer to the state prior
        // to our changes. However, if the user has accepted or rejected one or more diff blocks, there isn't a simple
        // way to undo our changes without also undoing the diff that the user accepted or rejected.
        if (hasAcceptedOrRejectedBlock) {
            ApplicationManager.getApplication().invokeLater {
                val blocksToReject = diffBlocks.toList()
                blocksToReject.toList().forEach { it.handleReject() }
            }
        } else {
            undoChanges()
            // We have to manually call `handleClosedState`, but above,
            // this is done by invoking the button handlers
            setClosed()
        }
    }

    fun streamDiffLinesToEditor(
        input: String,
        prefix: String,
        highlighted: String,
        suffix: String,
        modelTitle: String?,
        includeRulesInSystemMessage: Boolean,
        isApply: Boolean
    ) {
        isRunning = true
        sendUpdate(ApplyStateStatus.STREAMING)

        project.service<ContinuePluginService>().coreMessenger?.request(
            "streamDiffLines",
            StreamDiffLinesPayload(
                input = input,
                prefix = prefix,
                highlighted = highlighted,
                suffix = suffix,
                language = virtualFile?.fileType?.name,
                modelTitle = modelTitle,
                includeRulesInSystemMessage = includeRulesInSystemMessage,
                fileUri = virtualFile?.url,
                isApply = isApply
            ),
            null
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
        val editorUtils = EditorUtils(editor)
        val unfinishedKey = editorUtils.createTextAttributesKey("CONTINUE_DIFF_UNFINISHED_LINE", 0x20888888)

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
        } catch (e: Exception) {
            println(
                "Error handling diff line - " +
                        "Line index: ${curLine.index}, " +
                        "Line type: $type, " +
                        "Line text: $text, " +
                        "Error message: ${e.message}"
            )
        }
    }

    private fun handleDiffBlockAcceptOrReject(diffBlock: VerticalDiffBlock, didAccept: Boolean) {
        hasAcceptedOrRejectedBlock = true

        diffBlocks.remove(diffBlock)

        if (didAccept) {
            updatePositionsOnAccept(diffBlock.startLine)
        } else {
            updatePositionsOnReject(diffBlock.startLine, diffBlock.addedLines.size, diffBlock.deletedLines.size)
        }

        if (diffBlocks.isEmpty()) {
            setClosed()
        } else {
            // TODO: It's confusing that we pass `DONE` here. What we're doing is updating the UI with the latest
            // diff count. We should have a dedicated status for this.
            sendUpdate(ApplyStateStatus.DONE)
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
        val editorUtils = EditorUtils(editor)
        val curLineKey = editorUtils.createTextAttributesKey("CONTINUE_DIFF_CURRENT_LINE", 0x40888888)

        // Update the highlighter to show the current line
        curLine.highlighter?.let { editor.markupModel.removeHighlighter(it) }
        curLine.highlighter = editor.markupModel.addLineHighlighter(
            curLineKey, min(curLine.index, max(0, editor.document.lineCount - 1)), HighlighterLayer.LAST
        )

        editorUtils.scrollToLine(curLine.index)

        // Remove the unfinished lines highlighter
        if (type != DiffLineType.OLD && unfinishedHighlighters.isNotEmpty()) {
            editor.markupModel.removeHighlighter(unfinishedHighlighters.removeAt(0))
        }
    }

    private fun updatePositionsOnAccept(startLine: Int) {
        updatePositions(startLine, 0)
    }

    private fun updatePositionsOnReject(startLine: Int, numAdditions: Int, numDeletions: Int) {
        val offset = -numAdditions + numDeletions
        updatePositions(startLine, offset)
    }

    private fun updatePositions(startLine: Int, offset: Int) {
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

        // Close the Edit input if editing
        onClose()
    }


    private fun undoChanges() {
        if (virtualFile == null) {
            return
        }

        WriteCommandAction.runWriteCommandAction(project) {
            val undoManager = UndoManager.getInstance(project)
            val fileEditor = FileEditorManager.getInstance(project).getSelectedEditor(virtualFile) as TextEditor

            if (undoManager.isUndoAvailable(fileEditor)) {
                val numChanges = diffBlocks.sumOf { it.deletedLines.size + it.addedLines.size }

                repeat(numChanges) {
                    undoManager.undo(fileEditor)
                }
            }
        }
    }

    private fun handleFinishedResponse() {
        ApplicationManager.getApplication().invokeLater {
            // Since we only call onLastDiffLine() when we reach a "same" line, we need to handle the case where
            // the last line in the diff stream is in the middle of a diff block.
            curLine.diffBlock?.onLastDiffLine()

            onFinish()
            cleanupProgressHighlighters()

            if (diffBlocks.isEmpty()) {
                setClosed()
            } else {
                sendUpdate(ApplyStateStatus.DONE)
            }
        }
    }

    private fun cleanupProgressHighlighters() {
        curLine.highlighter?.let { editor.markupModel.removeHighlighter(it) }
        unfinishedHighlighters.forEach { editor.markupModel.removeHighlighter(it) }
    }


    private fun handleDiffLineResponse(parsed: Map<*, *>) {
        val data = parsed["content"] as Map<*, *>
        val diffLineType = getDiffLineType(data["type"] as String)
        val lineText = data["line"] as String

        ApplicationManager.getApplication().invokeLater {
            WriteCommandAction.runWriteCommandAction(project) {
                handleDiffLine(diffLineType, lineText)
            }
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

    private fun setClosed() {
        sendUpdate(ApplyStateStatus.CLOSED)
        resetState()
    }
}