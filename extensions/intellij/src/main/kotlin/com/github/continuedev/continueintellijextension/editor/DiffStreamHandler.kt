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
import com.intellij.openapi.editor.markup.EffectType
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
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
    // Text attributes keys
    private val greenKey = run {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(0x3000FF00.toInt(), 0x3000FF00.toInt())
        }
        val key = TextAttributesKey.createTextAttributesKey("CONTINUE_DIFF_NEW_LINE")
        key.let { editor.colorsScheme.setAttributes(it, attributes) }
        key
    }

    private val currentLineKey = run {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(0x40888888.toInt(), 0x40888888.toInt())
        }
        val key = TextAttributesKey.createTextAttributesKey("CONTINUE_DIFF_CURRENT_LINE")
        key.let { editor.colorsScheme.setAttributes(it, attributes) }
        key
    }

    private val unfinishedKey = run {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(0x20888888.toInt(), 0x20888888.toInt())
        }
        val key = TextAttributesKey.createTextAttributesKey("CONTINUE_DIFF_UNFINISHED_LINE")
        key.let { editor.colorsScheme.setAttributes(it, attributes) }
        key
    }

    private val editorComponentInlaysManager = EditorComponentInlaysManager.from(editor, false)

    // State variables
    private var currentLine = startLine
    private var currentLineHighlighter: RangeHighlighter? = null
    private val unfinishedHighlighters: MutableList<RangeHighlighter> = mutableListOf()
    private var changeCount: Int = 0  // Kept track of so we can count steps to undo when cancelling
    private var running: Boolean = false

    private var deletionBufferStartLine: Int = -1
    private val deletionsBuffer: MutableList<String> = mutableListOf()
    private val deletionInlays: MutableList<Disposable> = mutableListOf()

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
        // Insert red highlighted code between the real lines in the editor
        if (deletionBufferStartLine != -1 && deletionsBuffer.isNotEmpty()) {
            val component = JTextArea().apply {
                text = deletionsBuffer.joinToString("\n")
                isEditable = false
                background = JBColor(0x30FF0000.toInt(), 0x30FF0000.toInt())
                foreground = JBColor.GRAY
                border = BorderFactory.createEmptyBorder(0, 0, 0, 0)
                lineWrap = false
                wrapStyleWord = false
                font = editor.colorsScheme.getFont(EditorFontType.PLAIN)
            }

            val disposable = editorComponentInlaysManager.insert(deletionBufferStartLine, component, true)

            if (disposable != null) {
                deletionInlays.add(disposable)
            }

            // Clear the buffer
            deletionsBuffer.clear()
            deletionBufferStartLine = -1
        }
    }

    private fun handleDiffLine(type: DiffLineType, line: String) {
        println("DiffStreamHandler: handleDiffLine: $currentLine, $type, $line")
        try {
            when (type) {
                DiffLineType.SAME -> {
                    insertDeletionBuffer()
                    currentLine++
                }

                DiffLineType.NEW -> {
                    // Insert new line
                    if (currentLine == editor.document.lineCount) {
                        editor.document.insertString(editor.document.textLength, "\n")
                    }
                    val offset = editor.document.getLineStartOffset(currentLine)
                    editor.document.insertString(offset, line + "\n")

                    // Highlight the new line green
                    editor.markupModel.addLineHighlighter(greenKey, currentLine, HighlighterLayer.LAST)

                    insertDeletionBuffer()

                    currentLine++
                    changeCount++
                }

                DiffLineType.OLD -> {
                    // Remove old line
                    deleteLineAt(currentLine)

                    // Add to deletions buffer
                    deletionsBuffer.add(line)
                    if (deletionBufferStartLine == -1) {
                        deletionBufferStartLine = currentLine
                    }

                    changeCount++
                }
            }

            // Highlight the current line
            if (currentLineHighlighter != null) {
                editor.markupModel.removeHighlighter(currentLineHighlighter!!)
            }
            currentLineHighlighter = editor.markupModel.addLineHighlighter(
                currentLineKey,
                min(currentLine, editor.document.lineCount - 1),
                HighlighterLayer.LAST
            )

            // Remove the unfinished highlighter top line
            if (type != DiffLineType.OLD) {
                if (unfinishedHighlighters.isNotEmpty()) {
                    editor.markupModel.removeHighlighter(unfinishedHighlighters.removeAt(0))
                }
            }
        } catch (e: Exception) {
            println("Error handling diff line: $currentLine, $type, $line, $e.message")
        }
    }

    private fun resetState() {
        // Remove all highlighters
        editor.markupModel.removeAllHighlighters()

        // Remove all of the deletion inlays
        removeDeletionInlays()

        // Undo changes just by using builtin undo
        WriteCommandAction.runWriteCommandAction(project) {
            val undoManager = UndoManager.getInstance(project)
            val virtualFile = FileDocumentManager.getInstance().getFile(editor.document) ?: return@runWriteCommandAction
            val fileEditor = FileEditorManager.getInstance(project).getSelectedEditor(virtualFile) as TextEditor?
            if (undoManager.isUndoAvailable(fileEditor)) {
                for (i in 0 until changeCount) {
                    undoManager.undo(fileEditor)
                }
            }

            // Reset state variables
            currentLine = startLine
            changeCount = 0
        }
    }

    fun accept() {
        // Accept the changes
        editor.markupModel.removeAllHighlighters()
        removeDeletionInlays()
        onClose()
        running = false
    }

    fun reject() {
        // Reject the changes
        resetState()
        removeDeletionInlays()
        onClose()
        running = false
    }

    fun toggleFocus() {
        if (textArea.hasFocus()) {
            textArea.transferFocus()
            editor.contentComponent.requestFocus()
        } else {
            textArea.requestFocus()
        }
    }

    fun run(input: String, prefix: String, highlighted: String, suffix: String, modelTitle: String) {
        // Undo changes
        resetState()

        running = true

        // Highlight the range with unfinished color
        setup()

        // Request diff stream from core
        val continuePluginService = ServiceManager.getService(
            this.project,
            ContinuePluginService::class.java
        )
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)
        continuePluginService.coreMessenger?.request(
            "streamDiffLines", mapOf(
                "input" to input,
                "prefix" to prefix,
                "highlighted" to highlighted,
                "suffix" to suffix,
                "language" to virtualFile?.fileType?.name,
                "modelTitle" to modelTitle
            ), null
        ) { response ->
            if (!running) {
                return@request
            }

            val parsed = response as Map<*, *>
            val done = parsed["done"] as? Boolean
            if (done == true) {
                onFinish()

                ApplicationManager.getApplication().invokeLater {
                    // Clean up progress highlighters
                    if (currentLineHighlighter != null) {
                        editor.markupModel.removeHighlighter(currentLineHighlighter!!)
                    }
                    unfinishedHighlighters.forEach { editor.markupModel.removeHighlighter(it) }

                    // Flush deletion buffer
                    insertDeletionBuffer()

                    // Add ", " to the text area
                    textArea.document.insertString(textArea.caretPosition, ", ", null)
                    textArea.requestFocus()
                }

                return@request
            }
            val data = parsed["content"] as Map<*, *>
            val type = data["type"] as String
            val diffLineType = when (type) {
                "same" -> DiffLineType.SAME
                "new" -> DiffLineType.NEW
                "old" -> DiffLineType.OLD
                else -> throw Exception("Unknown diff line type: $type")
            }

            WriteCommandAction.runWriteCommandAction(project) {
                handleDiffLine(diffLineType, data["line"] as String)
            }
        }
    }
}