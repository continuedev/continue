package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CustomShortcutSet
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorSettings
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.ex.EditorSettingsExternalizable
import com.intellij.openapi.editor.highlighter.EditorHighlighterFactory
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.ui.popup.JBPopupListener
import com.intellij.openapi.ui.popup.LightweightWindowEvent
import com.intellij.psi.PsiDocumentManager
import com.intellij.ui.EditorTextField
import com.intellij.ui.components.JBScrollPane
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Dimension
import java.awt.FlowLayout
import java.awt.Point
import java.awt.event.ActionEvent
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import javax.swing.AbstractAction
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JScrollPane
import javax.swing.KeyStroke

@Service(Service.Level.PROJECT)
class NextEditWindowService(private val project: Project) {
    /**
     * Creates a Swing component that displays syntax-highlighted code.
     *
     * @param code The code to display
     * @param language The language/file extension of the code (e.g. "java", "kotlin", "py")
     * @param isEditable Whether the code should be editable (default: false)
     * @return A JComponent that can be added to the UI
     */
    fun createCodeViewer(code: String, language: String, document: Document, isEditable: Boolean = false): JComponent {
        // Get file type based on extension.
        // NOTE: This is actually IDE and tier-dependent. For example, TypeScript won't work on IntelliJ CE.
        val fileType = FileTypeManager.getInstance().getFileTypeByExtension(language)

        // Create an EditorTextField with the specified code and file type.
        val editorTextField = object : EditorTextField(code, project, fileType) {
            override fun createEditor(): EditorEx {
                val editor = super.createEditor()

                // Configure editor settings.
                val settings: EditorSettings = editor.settings
                settings.isLineNumbersShown = true
                settings.isLineMarkerAreaShown = true
                settings.isIndentGuidesShown = true
                settings.isVirtualSpace = false
                settings.isRightMarginShown = false
                settings.additionalLinesCount = 0
                settings.isShowingSpecialChars = false
                settings.isCaretRowShown = true

                // Set read-only if not editable.
                editor.isViewer = !isEditable

                // Syntax highlighter.
                // Get current editor color scheme.
                val currentScheme = EditorColorsManager.getInstance().globalScheme

                // Apply syntax highlighting with current theme.
                val virtualFile = FileDocumentManager.getInstance().getFile(document)
                var syntaxHighlighter = SyntaxHighlighterFactory.getSyntaxHighlighter(fileType, project, virtualFile)

                // If we couldn't get a syntax highlighter from the file, try to get one just from the file type.
                if (syntaxHighlighter == null) {
                    syntaxHighlighter = SyntaxHighlighterFactory.getSyntaxHighlighter(fileType, project, null)
                }

                // If we have a highlighter, apply it.
                if (syntaxHighlighter != null) {
                    editor.highlighter = EditorHighlighterFactory.getInstance().createEditorHighlighter(
                        syntaxHighlighter,
                        currentScheme
                    )
                } else {
                    // Fallback to plain text highlighting if all attempts fail.
                    val plainTextFileType = FileTypeManager.getInstance().getFileTypeByExtension("txt")
                    editor.highlighter = EditorHighlighterFactory.getInstance().createEditorHighlighter(
                        project,
                        plainTextFileType
                    )
                }

                // Apply the theme's background color.
                editor.backgroundColor = currentScheme.defaultBackground

                return editor
            }

            // Override to ensure multi-line support.
            override fun getPreferredSize(): Dimension {
                val lineCount = code.lines().size
                // Adjust height based on line count (with some minimum).
                val preferredSize = super.getPreferredSize()
                val lineHeight = preferredSize.height / (if (lineCount > 0) lineCount else 1)
                val newHeight = lineHeight * (if (lineCount > 0) lineCount else 1) + 10 // Add padding
                return Dimension(preferredSize.width, newHeight)
            }
        }

        // Enable multi-line mode.
        editorTextField.setOneLineMode(false)

        // Wrap in a scroll pane for larger code blocks.
        val panel = JPanel(BorderLayout())
        panel.add(JBScrollPane(editorTextField), BorderLayout.CENTER)

        return panel
    }

    /**
     * Shows a popup dialog with the code preview.
     */
    fun showCodePreview(code: String, parentEditor: Editor, completionId: String) {
        // Use invokeAndWait or invokeLater to ensure we're on the EDT.
        com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
            val codeViewer = createCodeViewer(code, getFileLanguage(parentEditor.document), parentEditor.document)

            // Create a button panel.
            val buttonPanel = JPanel(FlowLayout(FlowLayout.RIGHT))
            val acceptButton = JButton("Accept (Tab)")
            val dismissButton = JButton("Dismiss (Esc)")
            buttonPanel.add(acceptButton)
            buttonPanel.add(dismissButton)

            // Create a panel to hold the code viewer and buttons.
            val panel = JPanel(BorderLayout())
            panel.add(codeViewer, BorderLayout.CENTER)
            panel.add(buttonPanel, BorderLayout.SOUTH)


            // Create the popup.
            val popup = JBPopupFactory.getInstance()
                .createComponentPopupBuilder(panel, codeViewer)
                .setMovable(true)
                .setResizable(true)
                .setRequestFocus(true)
                .setCancelOnClickOutside(true)
                .setCancelOnOtherWindowOpen(true)
                .setFocusable(true)
                .addListener(object : JBPopupListener {
                    override fun onClosed(event: LightweightWindowEvent) {
                        if (!event.isOk) {
                            // This only triggers when dismissed, not when accepted.
                            println("Dismissing code preview popup")
                            project.service<ContinuePluginService>().coreMessenger?.request(
                                "nextEdit/reject",
                                hashMapOf("completionId" to completionId),
                                null, ({})
                            )
                        }
                    }
                })
                .createPopup()

            // Helper function to accept the code and apply it to the editor.
            fun acceptCode() {
                val document = parentEditor.document
                val caretModel = parentEditor.caretModel
                val caretOffset = caretModel.offset
                val caretPosition = document.getLineNumber(caretOffset)

                // Calculate start and end lines.
                val totalLines = document.lineCount
                val startLine = maxOf(0, caretPosition - 5)
                val endLine = minOf(totalLines - 1, caretPosition + 5)

                // Get start and end offsets.
                val startOffset = document.getLineStartOffset(startLine)
                val endOffset = document.getLineEndOffset(endLine)

                // Write command to replace the text.
                WriteCommandAction.runWriteCommandAction(project) {
                    document.replaceString(startOffset, endOffset, code)
                }

                project.service<ContinuePluginService>().coreMessenger?.request(
                    "nextEdit/accept",
                    hashMapOf("completionId" to completionId),
                    null, ({})
                )
            }

            // Use ActionManager to handle Tab key globally during popup display.
            val acceptAction = object : AnAction() {
                override fun actionPerformed(e: AnActionEvent) {
                    acceptCode()
                    popup.closeOk(null)
                }
            }

            // Create a custom shortcut set for the Tab key.
            val customShortcutSet = CustomShortcutSet(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0))


            // Register action with shortcut.
            acceptAction.registerCustomShortcutSet(customShortcutSet, panel)

            // Add button actions.
            acceptButton.addActionListener {
                acceptCode()
                popup.closeOk(null)
            }

            dismissButton.addActionListener {
                popup.cancel()
            }

            // Get the exact position of the cursor.
            val visualPosition = parentEditor.caretModel.visualPosition
            val cursorPoint = parentEditor.visualPositionToXY(visualPosition)

            // Convert to screen coordinates.
            val editorComponent = parentEditor.component
            val locationOnScreen = editorComponent.locationOnScreen
            val screenPoint = Point(
                locationOnScreen.x + cursorPoint.x,
                locationOnScreen.y + cursorPoint.y
            )

            // Show the popup at the cursor position.
            popup.showInScreenCoordinates(editorComponent, screenPoint)

            // Ensure proper focus for keyboard shortcuts.
            codeViewer.requestFocusInWindow()
        }
    }

    // Move editorConfig to a proper instance property that gets actual editor settings.
    private val editorConfig: EditorConfig by lazy {
        val settings = EditorSettingsExternalizable.getInstance()
        val editorFontSize = EditorColorsManager.getInstance().globalScheme.editorFontSize
        val editorFontFamily = EditorColorsManager.getInstance().globalScheme.editorFontName

        EditorConfig(
            fontSize = editorFontSize.toDouble(),
            fontFamily = editorFontFamily
        )
    }

    // Data class to hold editor configuration.
    private data class EditorConfig(
        val fontSize: Double = 14.0,
        val fontFamily: String = "JetBrains Mono"
    )

    /**
     * Convenience method to map common programming languages to their file extensions.
     */
    fun mapLanguageToExtension(language: String): String {
        return when (language.lowercase()) {
            "javascript" -> "js"
            "typescript" -> "ts"
            "python" -> "py"
            "java" -> "java"
            "kotlin" -> "kt"
            "c++" -> "cpp"
            "c#" -> "cs"
            "go" -> "go"
            "rust" -> "rs"
            "ruby" -> "rb"
            "php" -> "php"
            "swift" -> "swift"
            "shell", "bash" -> "sh"
            "html" -> "html"
            "css" -> "css"
            "json" -> "json"
            "xml" -> "xml"
            "yaml", "yml" -> "yaml"
            "markdown", "md" -> "md"
            // Add more mappings as needed
            else -> language
        }
    }

    private fun getFileLanguage(document: Document): String {
        val virtualFile = FileDocumentManager.getInstance().getFile(document)
        return virtualFile?.extension?.lowercase() ?: "text"
    }

    companion object {
        fun getInstance(project: Project): NextEditWindowService = project.service()
    }
}