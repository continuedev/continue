package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.command.undo.UndoManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.colors.EditorFontType
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
import javax.swing.BorderFactory
import javax.swing.JTextArea
import kotlin.math.min


enum class DiffLineType {
    SAME, NEW, OLD
}

class DiffStreamHandler(
    private val project: Project,
    private val editor: Editor,
    private val textArea: JTextArea,
    private val startLine: Int,
    private val endLine: Int,
    private val onClose: () -> Unit,
    private val onFinish: () -> Unit
) {

    private val editorComponentInlaysManager = EditorComponentInlaysManager.from(editor, false)
    private var currentLine = startLine
    private var currentLineHighlighter: RangeHighlighter? = null
    private val unfinishedHighlighters: MutableList<RangeHighlighter> = mutableListOf()
    private var changeCount: Int = 0
    private var insertedInCurrentBlock: Int = 0;
    private var running: Boolean = false
    private var deletionBufferStartLine: Int = -1
    private val deletionsBuffer: MutableList<String> = mutableListOf()
    private val deletionInlays: MutableList<Disposable> = mutableListOf()
    private val actionButtons: MutableList<VerticalDiffActionButtons> = mutableListOf()
    private val greenKey = createTextAttributesKey("CONTINUE_DIFF_NEW_LINE", 0x3000FF00.toInt())
    private val currentLineKey = createTextAttributesKey("CONTINUE_DIFF_CURRENT_LINE", 0x40888888.toInt())
    private val unfinishedKey = createTextAttributesKey("CONTINUE_DIFF_UNFINISHED_LINE", 0x20888888.toInt())

    private fun createTextAttributesKey(name: String, color: Int): TextAttributesKey {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(color, color)
        }

        return TextAttributesKey.createTextAttributesKey(name).also {
            editor.colorsScheme.setAttributes(it, attributes)
        }
    }

    private fun removeDeletionInlays() {
        deletionInlays.forEach {
            it.dispose()
        }
        deletionInlays.clear()
    }

    fun setup() {
        // Highlight the range with unfinished color
        for (i in startLine..endLine) {
            val highlighter = editor.markupModel.addLineHighlighter(
                unfinishedKey, min(
                    i, editor.document.lineCount - 1
                ), HighlighterLayer.LAST
            )
            unfinishedHighlighters.add(highlighter)
        }
    }

    private fun deleteLineAt(index: Int) {
        val startOffset = editor.document.getLineStartOffset(index)
        val endOffset = editor.document.getLineEndOffset(index) + 1
        editor.document.deleteString(startOffset, min(endOffset, editor.document.textLength))
    }

    private fun insertDeletionBuffer() {
        if (deletionsBuffer.isNotEmpty() || insertedInCurrentBlock > 0) {
            val start = currentLine - insertedInCurrentBlock
            val numGreen = insertedInCurrentBlock
            val numRed = deletionsBuffer.size
            val buttons = VerticalDiffActionButtons(
                editor,
                start,
                numRed,
                numGreen,
                ::acceptRejectBlock
            )

            actionButtons.add(
                buttons
            )

            editor.contentComponent.add(buttons.acceptButton)
            editor.contentComponent.add(buttons.rejectButton)
            editor.contentComponent.revalidate()
            editor.contentComponent.repaint()
        }

        if (deletionsBuffer.isEmpty()) {
            insertedInCurrentBlock = 0;
            return;
        }

        if (deletionBufferStartLine != -1) {
            val component = createDeletionComponent()
            val disposable = editorComponentInlaysManager.insert(deletionBufferStartLine, component, true)
            disposable?.let { deletionInlays.add(it) }

            deletionsBuffer.clear()
            deletionBufferStartLine = -1
        }

        insertedInCurrentBlock = 0;
    }


    private fun createDeletionComponent() = JTextArea().apply {
        text = deletionsBuffer.joinToString("\n")
        isEditable = false
        background = JBColor(0x30FF0000.toInt(), 0x30FF0000.toInt())
        foreground = JBColor.GRAY
        border = BorderFactory.createEmptyBorder()
        lineWrap = false
        wrapStyleWord = false
        font = editor.colorsScheme.getFont(EditorFontType.PLAIN)
    }


    private fun handleDiffLine(type: DiffLineType, line: String) {
        try {
            when (type) {
                DiffLineType.SAME -> handleSameLine()
                DiffLineType.NEW -> handleNewLine(line)
                DiffLineType.OLD -> handleOldLine(line)
            }

            updateCurrentLineHighlighter()
            removeUnfinishedHighlighter(type)
        } catch (e: Exception) {
            println("Error handling diff line: $currentLine, $type, $line, ${e.message}")
        }
    }

    private fun handleSameLine() {
        insertDeletionBuffer()
        currentLine++
    }

    private fun handleNewLine(line: String) {
        if (currentLine == editor.document.lineCount) {
            editor.document.insertString(editor.document.textLength, "\n")
        }

        val offset = editor.document.getLineStartOffset(currentLine)
        editor.document.insertString(offset, line + "\n")
        editor.markupModel.addLineHighlighter(greenKey, currentLine, HighlighterLayer.LAST)

        currentLine++
        changeCount++
        insertedInCurrentBlock++
    }

    private fun handleOldLine(line: String) {
        deleteLineAt(currentLine)
        deletionsBuffer.add(line)

        if (deletionBufferStartLine == -1) {
            deletionBufferStartLine = currentLine
        }

        changeCount++
    }

    private fun updateCurrentLineHighlighter() {
        currentLineHighlighter?.let { editor.markupModel.removeHighlighter(it) }
        currentLineHighlighter = editor.markupModel.addLineHighlighter(
            currentLineKey,
            min(currentLine, editor.document.lineCount - 1),
            HighlighterLayer.LAST
        )
    }

    private fun removeUnfinishedHighlighter(type: DiffLineType) {
        if (type != DiffLineType.OLD && unfinishedHighlighters.isNotEmpty()) {
            editor.markupModel.removeHighlighter(unfinishedHighlighters.removeAt(0))
        }
    }


    private fun acceptRejectBlock(accept: Boolean, startLine: Int, numGreen: Int, numRed: Int) {
        handleGreenLines(accept, startLine, numGreen, numRed)
        handleRedLines(accept, startLine, numRed)
        removeProcessedBlock(startLine)
        updatePositions(accept, startLine, numGreen, numRed)

        if (actionButtons.isEmpty()) {
            onComplete()
        }

        refreshEditor()
    }

    private fun handleGreenLines(accept: Boolean, startLine: Int, numGreen: Int, numRed: Int) {
        if (numGreen > 0) {
            removeHighlighters(startLine, numRed)
            if (!accept) {
                deleteLines(startLine + numRed, numGreen)
            }
        }
    }

    private fun handleRedLines(accept: Boolean, startLine: Int, numRed: Int) {
        if (numRed > 0 && accept) {
            deleteLines(startLine, numRed)
        }
    }

    private fun removeHighlighters(startLine: Int, numRed: Int) {
        val highlightersToRemove = editor.markupModel.allHighlighters.filter { highlighter ->
            val highlighterLine = editor.document.getLineNumber(highlighter.startOffset)
            if (numRed == 0) highlighterLine == startLine else highlighterLine in startLine until (startLine + numRed)
        }

        if (highlightersToRemove.isNotEmpty()) {
            editor.markupModel.removeHighlighter(highlightersToRemove.first())
        }
    }

    private fun deleteLines(startLine: Int, numLines: Int) {
        WriteCommandAction.runWriteCommandAction(project) {
            for (i in 0 until numLines) {
                deleteLineAt(startLine)
            }
        }
    }

    private fun removeProcessedBlock(startLine: Int) {
        val curActionButtons = actionButtons.find { it.line == startLine }
        curActionButtons?.removeButtons()
        actionButtons.remove(curActionButtons)
    }

    private fun updatePositions(accept: Boolean, startLine: Int, numGreen: Int, numRed: Int) {
        val offset = -(if (accept) numRed else numGreen)
        actionButtons.forEach { buttons ->
            if (buttons.line > startLine) {
                buttons.updatePosition(buttons.line + offset)
            }
        }
    }

    private fun refreshEditor() {
        editor.contentComponent.revalidate()
        editor.contentComponent.repaint()
    }

    private fun resetState() {
        editor.markupModel.removeAllHighlighters()
        removeDeletionInlays()
        undoChanges()
        resetStateVariables()
    }


    private fun undoChanges() {
        WriteCommandAction.runWriteCommandAction(project) {
            val undoManager = UndoManager.getInstance(project)
            val fileEditor = getFileEditor() ?: return@runWriteCommandAction

            if (undoManager.isUndoAvailable(fileEditor)) {
                repeat(changeCount) {
                    undoManager.undo(fileEditor)
                }
            }
        }
    }

    private fun getFileEditor(): TextEditor? {
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document) ?: return null
        return FileEditorManager.getInstance(project).getSelectedEditor(virtualFile) as TextEditor?
    }

    private fun resetStateVariables() {
        currentLine = startLine
        changeCount = 0
    }


    private fun removeActionButtons() {
        actionButtons.forEach { buttons -> buttons.removeButtons() }
        actionButtons.clear()
    }

    private fun onComplete() {
        removeDeletionInlays()
        onClose()
        running = false
        removeActionButtons()
        changeCount = 0
    }

    fun acceptAll() {
        editor.markupModel.removeAllHighlighters()
        onComplete()
    }

    fun rejectAll() {
        resetState()
        onComplete()
    }

    fun run(input: String, prefix: String, highlighted: String, suffix: String, modelTitle: String) {
        resetState()
        running = true
        setup()

        val continuePluginService = ServiceManager.getService(project, ContinuePluginService::class.java)
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)

        continuePluginService.coreMessenger?.request(
            "streamDiffLines",
            createRequestParams(input, prefix, highlighted, suffix, virtualFile, modelTitle),
            null
        ) { response ->
            if (!running) return@request

            val parsed = response as Map<*, *>
            if (parsed["done"] as? Boolean == true) {
                handleFinishedResponse()
                return@request
            }

            handleDiffLineResponse(parsed)
        }
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
            insertDeletionBuffer()
            appendToTextArea()
        }
    }

    private fun cleanupProgressHighlighters() {
        currentLineHighlighter?.let { editor.markupModel.removeHighlighter(it) }
        unfinishedHighlighters.forEach { editor.markupModel.removeHighlighter(it) }
    }

    private fun appendToTextArea() {
        textArea.document.insertString(textArea.caretPosition, ", ", null)
        textArea.requestFocus()
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