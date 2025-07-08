package com.github.continuedev.continueintellijextension.nextEdit

import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorSettings
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.ex.EditorSettingsExternalizable
import com.intellij.openapi.editor.highlighter.EditorHighlighterFactory
import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ui.EditorTextField
import com.intellij.ui.components.JBScrollPane
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Dimension
import java.awt.FlowLayout
import java.awt.Point
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JScrollPane

@Service(Service.Level.PROJECT)
class NextEditWindowService(private val project: Project) {
    /**
     * Creates a Swing component that displays syntax-highlighted code
     *
     * @param code The code to display
     * @param language The language/file extension of the code (e.g. "java", "kotlin", "py")
     * @param isEditable Whether the code should be editable (default: false)
     * @return A JComponent that can be added to the UI
     */
    fun createCodeViewer(code: String, language: String, isEditable: Boolean = false): JComponent {
        // Get file type based on extension
        val fileType = FileTypeManager.getInstance().getFileTypeByExtension(language)

        // Create an EditorTextField with the specified code and file type
        val editorTextField = object : EditorTextField(code, project, fileType) {
            override fun createEditor(): EditorEx {
                val editor = super.createEditor()

                // Configure editor settings
                val settings: EditorSettings = editor.settings
                settings.isLineNumbersShown = true
                settings.isLineMarkerAreaShown = true
                settings.isIndentGuidesShown = true
                settings.isVirtualSpace = false
                settings.isRightMarginShown = false
                settings.additionalLinesCount = 0
                settings.isShowingSpecialChars = false
                settings.isCaretRowShown = true

                // Set read-only if not editable
                editor.isViewer = !isEditable

                // Syntax highlighter
                val syntaxHighlighter = SyntaxHighlighterFactory.getSyntaxHighlighter(fileType, project, null)
                editor.highlighter = EditorHighlighterFactory.getInstance().createEditorHighlighter(
                    syntaxHighlighter,
                    EditorColorsManager.getInstance().globalScheme
                )

                return editor
            }
        }

        // Wrap in a scroll pane for larger code blocks
        val panel = JPanel(BorderLayout())
        panel.add(JBScrollPane(editorTextField), BorderLayout.CENTER)

        return panel
    }

    /**
     * Shows a popup dialog with the code preview
     */
    fun showCodePreview(code: String, language: String, parentEditor: Editor) {
        // Use invokeAndWait or invokeLater to ensure we're on the EDT
        com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
            val codeViewer = createCodeViewer(code, language)
            // Create a panel to hold the code viewer and buttons
            val panel = JPanel(BorderLayout())
            panel.add(codeViewer, BorderLayout.CENTER)
            // Create a button panel
            val buttonPanel = JPanel(FlowLayout(FlowLayout.RIGHT))

            val acceptButton = JButton("Accept")
            acceptButton.addActionListener {
                // TODO: Implement code acceptance logic
                // This should apply the prediction to the actual editor
            }

            val dismissButton = JButton("Dismiss")

            buttonPanel.add(acceptButton)
            buttonPanel.add(dismissButton)
            panel.add(buttonPanel, BorderLayout.SOUTH)

                // Create a popup
            val popup = JBPopupFactory.getInstance()
                .createComponentPopupBuilder(panel, codeViewer)
                .setTitle("Next Edit Preview")
                .setMovable(true)
                .setResizable(true)
                .setRequestFocus(true)
                .setCancelOnClickOutside(true)  // Allow clicking outside to close
                .setCancelOnOtherWindowOpen(true)  // Close when another window opens
                .setFocusable(true)
                .createPopup()

            // Add dismiss action
            dismissButton.addActionListener {
                popup.cancel()
            }
            // Get the exact position of the cursor
            val visualPosition = parentEditor.caretModel.visualPosition
            val cursorPoint = parentEditor.visualPositionToXY(visualPosition)

            // Convert to screen coordinates
            val editorComponent = parentEditor.component
            val locationOnScreen = editorComponent.locationOnScreen
            val screenPoint = Point(
                locationOnScreen.x + cursorPoint.x,
                locationOnScreen.y + cursorPoint.y
            )

            // Show the popup at the cursor position
            popup.showInScreenCoordinates(editorComponent, screenPoint)
        }
    }

    // Move editorConfig to a proper instance property that gets actual editor settings
    private val editorConfig: EditorConfig by lazy {
        val settings = EditorSettingsExternalizable.getInstance()
        val editorFontSize = EditorColorsManager.getInstance().globalScheme.editorFontSize
        val editorFontFamily = EditorColorsManager.getInstance().globalScheme.editorFontName

        EditorConfig(
            fontSize = editorFontSize.toDouble(),
            fontFamily = editorFontFamily
        )
    }

    // Data class to hold editor configuration
    private data class EditorConfig(
        val fontSize: Double = 14.0,
        val fontFamily: String = "JetBrains Mono"
    )

    /**
     * Convenience method to map common programming languages to their file extensions
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

    companion object {
        fun getInstance(project: Project): NextEditWindowService = project.service()
    }
}