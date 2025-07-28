package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.runWriteAction
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
import com.intellij.openapi.editor.ScrollType
import com.intellij.openapi.vfs.LocalFileSystem
import java.io.File

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
     * Gets the full text content of the document
     */
    fun getDocumentText(): String {
        return editor.document.text
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
     * Scrolls the editor to make the specified line visible
     */
    fun scrollToLine(lineNumber: Int) {
        val safeLineNumber = lineNumber.coerceIn(0, editor.document.lineCount - 1)
        val lineStartOffset = editor.document.getLineStartOffset(safeLineNumber)
        val logicalPosition = editor.offsetToLogicalPosition(lineStartOffset)
        editor.scrollingModel.scrollTo(logicalPosition, ScrollType.CENTER_UP)
    }

    /**
     * Remove the selected range in a thread-safe manner
     */
    fun removeSelection() {
        ApplicationManager.getApplication().invokeLater {
            editor.selectionModel.removeSelection()
        }
    }

    /**
     * Extracts code ranges from the editor: (prefix, highlighted/selected text, suffix)
     */
    fun getHighlightedRangeTriplet(): Triple<String, String, String> {
        val rif = getHighlightedRIF()

        return if (rif == null) {
            // If no highlight, use the whole document as highlighted
            Triple("", editor.document.text, "")
        } else {
            // Use the RangeInFileWithContents to get absolute offsets
            val (startOffset, endOffset) = rif.offsets

            val prefix = editor.document.getText(TextRange(0, startOffset))
            val highlighted = rif.contents
            val suffix = editor.document.getText(TextRange(endOffset, editor.document.textLength))

            removeSelection()

            Triple(prefix, highlighted, suffix)
        }
    }

    /**
     * Gets the selected code from the current editor.
     * Returns null if there is no selection.
     */
    fun getHighlightedRIF(): RangeInFileWithContents? {
        return ApplicationManager.getApplication().runReadAction<RangeInFileWithContents?> {
            val virtualFile =
                FileDocumentManager.getInstance().getFile(editor.document) ?: return@runReadAction null

            // Get the selection range
            val selectionModel: SelectionModel = editor.selectionModel
            val startOffset = selectionModel.selectionStart
            val endOffset = selectionModel.selectionEnd

            if (startOffset == endOffset) {
                return@runReadAction null
            }

            return@runReadAction virtualFile.toUriOrNull()?.let {
                RangeInFileWithContents.fromSelection(
                    it,
                    editor.document,
                    startOffset,
                    endOffset
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

        /**
         * Gets editor for the filepath is existed
         */
        fun editorFileExist(filepath: String?): Boolean {
            return !filepath.isNullOrEmpty() && VirtualFileManager.getInstance().findFileByUrl(filepath) != null
        }

        /**
         * Gets editor for the no exist filepath and returns an EditorUtils instance
         */
        fun getEditorByCreateFile(project: Project, filepath: String?): EditorUtils? {
            if (!filepath.isNullOrEmpty()) {
                // file not exists and create
                val ioFile = File(filepath.replace("file:///", ""))
                if (!ioFile.exists()) {
                    ioFile.parentFile?.mkdirs()
                    ioFile.createNewFile()
                }
                // IntelliJ refresh VirtualFile
                val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(ioFile)
                if (virtualFile != null) {
                    ApplicationManager.getApplication().invokeAndWait {
                        runWriteAction {
                            FileEditorManager.getInstance(project).openFile(virtualFile, true)
                        }
                    }
                }
            }

            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return null
            return EditorUtils(editor)
        }
    }
}
