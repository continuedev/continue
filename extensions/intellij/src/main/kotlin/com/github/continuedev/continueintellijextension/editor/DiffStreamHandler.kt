package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.command.undo.UndoManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.JBColor
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

    private var currentLine = startLine
    private var currentLineHighlighter: RangeHighlighter? = null
    private val unfinishedHighlighters: MutableList<RangeHighlighter> = mutableListOf()
    private var isRunning: Boolean = false
    private val diffBlocks: MutableList<VerticalDiffBlock> = mutableListOf()
    private var curDiffBlock: VerticalDiffBlock? = null
    private val currentLineKey = createTextAttributesKey("CONTINUE_DIFF_CURRENT_LINE", 0x40888888, editor)
    private val unfinishedKey = createTextAttributesKey("CONTINUE_DIFF_UNFINISHED_LINE", 0x20888888, editor)

    init {
        initUnfinishedRangeHighlights()
    }

    companion object {
        fun createTextAttributesKey(name: String, color: Int, editor: Editor): TextAttributesKey {
            val attributes = TextAttributes().apply {
                backgroundColor = JBColor(color, color)
            }

            return TextAttributesKey.createTextAttributesKey(name).also {
                editor.colorsScheme.setAttributes(it, attributes)
            }
        }
    }

    fun acceptAll() {
        editor.markupModel.removeAllHighlighters()
        resetState()
    }

    fun rejectAll() {
        // TODO: Need to handle differently if we've accepted or rejected a block, althought we probably want to just remove this logic
        undoChanges()
        resetState()
    }

    fun streamDiffLinesToEditor(
        input: String,
        prefix: String,
        highlighted: String,
        suffix: String,
        modelTitle: String
    ) {
//        resetState()

        isRunning = true

        val continuePluginService = ServiceManager.getService(project, ContinuePluginService::class.java)
        val virtualFile = getVirtualFile()

        continuePluginService.coreMessenger?.request(
            "streamDiffLines",
            createRequestParams(input, prefix, highlighted, suffix, virtualFile, modelTitle),
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
        for (i in startLine..endLine) {
            val highlighter = editor.markupModel.addLineHighlighter(
                unfinishedKey, min(
                    i, editor.document.lineCount - 1
                ), HighlighterLayer.LAST
            )
            unfinishedHighlighters.add(highlighter)
        }
    }

    private fun handleDiffLine(type: DiffLineType, line: String) {
        try {
            when (type) {
                DiffLineType.SAME -> handleSameLine()
                DiffLineType.NEW -> handleNewLine(line)
                DiffLineType.OLD -> handleOldLine()
            }
            updateProgressHighlighters(type)
        } catch (e: Exception) {
            println("Error handling diff line: $currentLine, $type, $line, ${e.message}")
        }
    }

    private fun createDiffBlock(): VerticalDiffBlock {
        val diffBlock = VerticalDiffBlock(
            editor,
            project,
            currentLine
        ) { block, didAccept ->
            diffBlocks.remove(block)
            block.clear()
            updatePositions(didAccept, block.startLine, block.deletedLines.size, block.addedLines.size)

            if (diffBlocks.isEmpty()) {
                onClose()
            }
        }

        diffBlocks.add(diffBlock)

        return diffBlock
    }

    private fun handleSameLine() {
        if (curDiffBlock != null) {
            curDiffBlock!!.onLastDiffLine()
        }

        curDiffBlock = null

        currentLine++
    }

    private fun handleNewLine(text: String) {
        if (curDiffBlock == null) {
            curDiffBlock = createDiffBlock()
        }

        curDiffBlock!!.addNewLine(text, currentLine)

        currentLine++
    }

    private fun handleOldLine() {
        if (curDiffBlock == null) {
            curDiffBlock = createDiffBlock()
        }

        curDiffBlock!!.deleteLineAt(currentLine)
    }

    private fun updateProgressHighlighters(type: DiffLineType) {
        // Update the highlighter to show the current line
        currentLineHighlighter?.let { editor.markupModel.removeHighlighter(it) }
        currentLineHighlighter = editor.markupModel.addLineHighlighter(
            currentLineKey,
            min(currentLine, editor.document.lineCount - 1),
            HighlighterLayer.LAST
        )

        // Remove the unfinished lines highlighter
        if (type != DiffLineType.OLD && unfinishedHighlighters.isNotEmpty()) {
            editor.markupModel.removeHighlighter(unfinishedHighlighters.removeAt(0))
        }
    }


    private fun updatePositions(didAccept: Boolean, startLine: Int, numAdditions: Int, numDeletions: Int) {
        val offset = -(if (didAccept) numDeletions else numAdditions)

        diffBlocks.forEach { buttons ->
            if (buttons.startLine > startLine) {
                buttons.updatePosition(buttons.startLine + offset)
            }
        }
    }

    private fun resetState() {
        // Clear the editor of highlighting/inlays
        editor.markupModel.removeAllHighlighters()
        diffBlocks.forEach { it.clear() }

        // Clear state vars
        diffBlocks.clear()
        currentLine = startLine
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

            // In case we don't hit a "same" line before ending
            curDiffBlock!!.onLastDiffLine()
        }
    }

    private fun cleanupProgressHighlighters() {
        currentLineHighlighter?.let { editor.markupModel.removeHighlighter(it) }
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