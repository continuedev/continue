package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.Range
import com.github.continuedev.continueintellijextension.RangeInFileWithContents
import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.ui.JBColor

/**
 * Utility class for working with Editor instances.
 */
class EditorUtils(val editor: Editor) {
    private val project: Project
        get() = editor.project!!

    /**
     * Checks if the editor is a terminal editor
     */
    fun isTerminal(): Boolean {
        return editor.javaClass.name.contains("Terminal")
    }

    /**
     * Checks if the document is empty (contains only whitespace)
     */
    fun isDocumentEmpty(): Boolean {
        return editor.document.text.trim().isEmpty()
    }

    /**
     * Gets the total number of lines in the document
     */
    fun getLineCount(): Int {
        return editor.document.lineCount
    }

    /**
     * Inserts text at the specified position in the document
     */
    fun insertTextAtPos(pos: Int, text: String) {
        WriteCommandAction.runWriteCommandAction(project) {
            editor.document.insertString(pos, text)
        }
    }

    /**
     * Inserts text at the beginning of the document
     */
    fun insertTextIntoEmptyDocument(text: String) {
        insertTextAtPos(0, text)
    }

    /**
     * Extracts code ranges from the editor: (prefix, highlighted/selected text, suffix)
     */
    fun extractCodeRanges(): Triple<String, String, String> {
        val rif = getHighlightedCode()

        return if (rif == null) {
            // If no highlight, use the whole document as highlighted
            Triple("", editor.document.text, "")
        } else {
            val prefix = editor.document.getText(TextRange(0, rif.range.start.character))
            val highlighted = rif.contents
            val suffix =
                editor.document.getText(TextRange(rif.range.end.character, editor.document.textLength))

            // Remove the selection after processing
            ApplicationManager.getApplication().invokeLater {
                editor.selectionModel.removeSelection()
            }

            Triple(prefix, highlighted, suffix)
        }
    }

    /**
     * Gets the selected code from the current editor.
     * Returns null if there is no selection.
     */
    fun getHighlightedCode(): RangeInFileWithContents? {
        return ApplicationManager.getApplication().runReadAction<RangeInFileWithContents?> {
            val virtualFile =
                FileDocumentManager.getInstance().getFile(editor.document) ?: return@runReadAction null

            // Get the selection range and content
            val selectionModel: SelectionModel = editor.selectionModel
            val selectedText = selectionModel.selectedText ?: ""

            val document = editor.document
            val startOffset = selectionModel.selectionStart
            val endOffset = selectionModel.selectionEnd

            if (startOffset == endOffset) {
                return@runReadAction null
            }

            val startLine = document.getLineNumber(startOffset)
            val endLine = document.getLineNumber(endOffset)

            val startChar = startOffset - document.getLineStartOffset(startLine)
            val endChar = endOffset - document.getLineStartOffset(endLine)

            return@runReadAction virtualFile.toUriOrNull()?.let {
                RangeInFileWithContents(
                    it, Range(
                        Position(startLine, startChar),
                        Position(endLine, endChar)
                    ), selectedText
                )
            }
        }
    }

    fun createTextAttributesKey(name: String, color: Int): TextAttributesKey {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(color, color)
        }

        return TextAttributesKey.createTextAttributesKey(name).also {
            editor.colorsScheme.setAttributes(it, attributes)
        }
    }

    companion object {
        /**
         * Gets an editor for the currently selected file without opening any new files
         */
        fun getEditor(project: Project): EditorUtils? {
            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return null
            return EditorUtils(editor)
        }
        
        /**
         * Gets or opens an editor for the specified filepath and returns an EditorUtils instance
         */
        fun getOrOpenEditor(project: Project, filepath: String?): EditorUtils? {
            if (!filepath.isNullOrEmpty()) {
                val virtualFile = VirtualFileManager.getInstance().findFileByUrl(filepath)
                if (virtualFile != null) {
                    ApplicationManager.getApplication().invokeAndWait {
                        FileEditorManager.getInstance(project).openFile(virtualFile, true).first()
                    }
                }
            }

            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return null
            return EditorUtils(editor)
        }
    }
}
