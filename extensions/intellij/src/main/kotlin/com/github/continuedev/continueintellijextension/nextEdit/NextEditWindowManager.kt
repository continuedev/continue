package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.listeners.ActiveHandlerManager
import com.github.continuedev.continueintellijextension.utils.InlineCompletionUtils
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.EDT
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.markup.*
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopup
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.util.TextRange
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBPanel
import com.intellij.util.ui.JBUI
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.awt.*
import java.awt.event.ActionEvent
import java.awt.event.KeyEvent
import java.awt.geom.RoundRectangle2D
import javax.swing.*
import javax.swing.border.AbstractBorder

@Service(Service.Level.PROJECT)
class NextEditWindowManager(private val project: Project) {
    private val coroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    private var currentPopup: JBPopup? = null
    private var deletionHighlighters: List<RangeHighlighter> = emptyList()
    private var isAccepted = false
    private var currentCompletionId: String? = null

    // Handler management
    private var windowHandler: NextEditWindowHandler? = null

    suspend fun showNextEditWindow(
        editor: Editor,
        currCursorPos: Position,
        editableRegionStartLine: Int,
        editableRegionEndLine: Int,
        oldCode: String,
        newCode: String,
        diffLines: List<DiffLine>
    ) {
        // Clear existing decorations first
        hideAllNextEditWindows()

        // Register active handler for this window
        val cursorPosition = LogicalPosition(currCursorPos.line, currCursorPos.character)
        windowHandler = NextEditWindowHandler(project, this, cursorPosition)
        val activeHandlerManager = project.getService(ActiveHandlerManager::class.java)
        activeHandlerManager.setActiveHandler(windowHandler!!)

        // Determine if this is a line deletion case
        val isLineDelete = determineIfLineDelete(
            editor,
            editableRegionStartLine,
            editableRegionEndLine,
            oldCode,
            newCode,
            diffLines
        )

        // Show the code popup with the new suggestion
        showCodePopup(editor, newCode, diffLines) { action ->
            when (action) {
                PopupAction.ACCEPT -> acceptEdit(
                    editor,
                    newCode,
                    editableRegionStartLine,
                    editableRegionEndLine,
                    isLineDelete
                )

                PopupAction.REJECT -> rejectEdit()
            }
        }

        // Render deletion strikethroughs in the editor
        renderDeletionDecorations(editor, oldCode, newCode, editableRegionStartLine)
    }

    private fun determineIfLineDelete(
        editor: Editor,
        editableRegionStartLine: Int,
        editableRegionEndLine: Int,
        oldCode: String,
        newCode: String,
        diffLines: List<DiffLine>
    ): Boolean {
        // Check if new code is empty and we're dealing with a single line
        if (newCode != "" || editableRegionStartLine != editableRegionEndLine) {
            return false
        }

        // Check if diffLines contains only deletions (no additions)
        val onlyDeletions = diffLines.all { it.type == "old" || it.type == "same" }
        val hasDeletedLine = diffLines.any { it.type == "old" }

        if (!onlyDeletions || !hasDeletedLine) {
            return false
        }

        // Fix: Use the correct method to get line text
        val startOffset = editor.document.getLineStartOffset(editableRegionStartLine)
        val endOffset = editor.document.getLineEndOffset(editableRegionStartLine)
        val line = editor.document.getText(TextRange(startOffset, endOffset))
        val oldLine = oldCode.trim()

        return line.trim() == oldLine || line.trim().isEmpty()
    }

    private fun showCodePopup(
        editor: Editor,
        code: String,
        diffLines: List<DiffLine>,
        onAction: (PopupAction) -> Unit
    ) {
        val popupComponent = createNextEditPopupComponent(editor, code, diffLines, onAction)

        val popup = JBPopupFactory.getInstance()
            .createComponentPopupBuilder(popupComponent, popupComponent)
            .setFocusable(true)
            .setRequestFocus(true)
            .setResizable(false)
            .setMovable(false)
            .setCancelOnClickOutside(false)
            .setCancelOnWindowDeactivation(false)
            .setCancelKeyEnabled(false)
            .setModalContext(true)
            .setCancelCallback {
                onAction(PopupAction.REJECT)
                true
            }
            .createPopup()

        currentPopup = popup

        popup.content.addFocusListener(object : java.awt.event.FocusAdapter() {
            override fun focusLost(e: java.awt.event.FocusEvent?) {
                if (e?.isTemporary == false && popup.isVisible && !isAccepted) {
                    ApplicationManager.getApplication().invokeLater {
                        if (popup.isVisible && !popup.isDisposed) {
                            popupComponent.requestFocusInWindow()
                        }
                    }
                }
            }
        })

        // Show popup and ensure focus
        ApplicationManager.getApplication().invokeLater {
            try {
                val caretPosition = editor.caretModel.primaryCaret.logicalPosition
                val currentLine = caretPosition.line
                val lineEndOffset = editor.document.getLineEndOffset(currentLine)
                val lineText = editor.document.getText(
                    TextRange(
                        editor.document.getLineStartOffset(currentLine),
                        lineEndOffset
                    )
                )

                val endOfLinePosition = LogicalPosition(currentLine, lineText.length + 4)
                val endOfLinePoint = editor.logicalPositionToXY(endOfLinePosition)

                val editorComponent = editor.contentComponent
                val screenPoint = java.awt.Point(endOfLinePoint.x, endOfLinePoint.y)
                javax.swing.SwingUtilities.convertPointToScreen(screenPoint, editorComponent)

                popup.showInScreenCoordinates(editorComponent, screenPoint)

                // Add ONLY the popup content border with rounded corners
                val content = popup.content
                if (content is JComponent) {
                    content.border = object : AbstractBorder() {
                        override fun paintBorder(c: Component, g: Graphics, x: Int, y: Int, width: Int, height: Int) {
                            val g2 = g.create() as Graphics2D
                            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

                            val arc = 6f
                            g2.color = Color(0x999998)
                            g2.stroke = BasicStroke(1f)
                            g2.draw(
                                RoundRectangle2D.Float(
                                    x.toFloat(),
                                    y.toFloat(),
                                    width.toFloat() - 1f,
                                    height.toFloat() - 1f,
                                    arc,
                                    arc
                                )
                            )
                            g2.dispose()
                        }

                        override fun getBorderInsets(c: Component): Insets = JBUI.insets(1)
                    }
                }

                // Force focus after popup is shown
                ApplicationManager.getApplication().invokeLater {
                    popupComponent.requestFocusInWindow()
                }
            } catch (e: Exception) {
                popup.showInBestPositionFor(editor)
                ApplicationManager.getApplication().invokeLater {
                    popupComponent.requestFocusInWindow()
                }
            }
        }
    }

    private fun createNextEditPopupComponent(
        editor: Editor,
        code: String,
        diffLines: List<DiffLine>,
        onAction: (PopupAction) -> Unit
    ): JComponent {
        val panel = JBPanel<JBPanel<*>>().apply {
            layout = BorderLayout()
//            border = JBUI.Borders.empty(8, 12)
            border = null
            background = EditorColorsManager.getInstance().globalScheme.defaultBackground
            isFocusable = true
            isFocusCycleRoot = true
            // No custom paintComponent - just use regular panel
        }

        // Create syntax-highlighted code display
        val codePanel = createCodeDisplayPanel(editor, code, diffLines)
        panel.add(codePanel, BorderLayout.CENTER)

        // Add keyboard shortcuts
        addKeyboardShortcuts(panel, onAction)

        return panel
    }

    private fun getActualFontSizeFromEditor(editor: Editor): Int {
        try {
            val component = editor.contentComponent
            val font = component.font
            val graphics = component.graphics

            if (graphics != null) {
                val fontMetrics = graphics.getFontMetrics(font)
                val height = fontMetrics.height
                val ascent = fontMetrics.ascent

                // Check for DPI scaling
                val scale = JBUI.scale(1f)

                // Adjust for DPI scaling
                val adjustedFontSize = if (scale > 1f) {
                    (font.size / scale).toInt()
                } else {
                    font.size
                }

                return adjustedFontSize
            }

        } catch (e: Exception) {
            println("DEBUG: Error getting font size: ${e.message}")
        }

        return 13
    }

    private fun createCodeDisplayPanel(editor: Editor, code: String, diffLines: List<DiffLine>): JComponent {
        try {
            val scheme = EditorColorsManager.getInstance().globalScheme
            val editorFont = editor.colorsScheme.getFont(com.intellij.openapi.editor.colors.EditorFontType.PLAIN)

            // Get the actual font size accounting for DPI scaling
            val actualFontSize = getActualFontSizeFromEditor(editor)
            val fontFamily = editorFont.family

            // Also get the line height from editor for consistent spacing
            val editorLineHeight = editor.lineHeight
            val uiScale = JBUI.scale(1f)
//            val adjustedLineHeight = if (uiScale > 1f) (editorLineHeight / uiScale).toInt() else editorLineHeight

//            val adjustedLineHeight = actualFontSize
            val adjustedLineHeight = editor.colorsScheme.lineSpacing

            // Get file type for proper syntax highlighting
            val fileType = getCurrentFileType(editor)

            // Create panel with proper layout
            val panel = JPanel().apply {
                layout = BoxLayout(this, BoxLayout.Y_AXIS)
                background = scheme.defaultBackground
                border = null
                isOpaque = true
            }

            val visibleLines = diffLines.filter { it.type != "old" }
            val linesToDisplay = if (visibleLines.isEmpty()) {
                if (code.isNotEmpty()) {
                    code.split("\n").map { DiffLine(type = "new", line = it) }
                } else {
                    listOf(DiffLine(type = "new", line = " "))
                }
            } else {
                visibleLines
            }

            var maxWidth = 200

            // Create syntax-highlighted labels for each line
            linesToDisplay.forEach { diffLine ->
                val displayText = if (diffLine.line.isEmpty()) " " else diffLine.line

                val backgroundColor = when (diffLine.type) {
                    "new" -> JBColor(0x2D4A2D, 0x2D4A2D)
                    "same" -> scheme.defaultBackground
                    else -> scheme.defaultBackground
                }

                val highlightedHtml = createSyntaxHighlightedHtml(
                    displayText,
                    fileType,
                    scheme,
                    fontFamily,
                    actualFontSize,
                    adjustedLineHeight, // Pass the adjusted line height
                    backgroundColor
                )

                val label = JLabel(highlightedHtml).apply {
                    background = backgroundColor
                    isOpaque = true
                    border = JBUI.Borders.empty(1, 6)
                    alignmentX = Component.LEFT_ALIGNMENT

                    // Create font with correct size
//                    font = Font(fontFamily, editorFont.style, actualFontSize)
                }

                maxWidth = maxOf(maxWidth, label.preferredSize.width + 12)
                panel.add(label)
            }

            panel.revalidate()
            val contentHeight = maxOf(panel.preferredSize.height, 20)

            return JScrollPane(panel).apply {
                border = null
                preferredSize = Dimension(maxWidth, contentHeight)
                minimumSize = Dimension(200, 20)
                maximumSize = Dimension(800, 300)
                horizontalScrollBarPolicy = JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED
                verticalScrollBarPolicy = JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED
                viewport.background = scheme.defaultBackground
                background = scheme.defaultBackground
            }

        } catch (e: Exception) {
            println("ERROR: createCodeDisplayPanel failed: ${e.message}")
            e.printStackTrace()
            return JLabel("Code preview unavailable").apply {
                border = JBUI.Borders.empty(10)
            }
        }
    }

    private fun createSyntaxHighlightedHtml(
        text: String,
        fileType: FileType,
        scheme: com.intellij.openapi.editor.colors.EditorColorsScheme,
        fontFamily: String,
        fontSize: Int,
        lineHeight: Float,
        backgroundColor: Color
    ): String {
        // Convert background color to hex
        val backgroundHex =
            String.format("#%02x%02x%02x", backgroundColor.red, backgroundColor.green, backgroundColor.blue)

        if (text.trim().isEmpty()) {
            return "<html><body style='margin:0; padding:2px 6px; background-color:$backgroundHex;'>" +
                    "<div style='font-family:\"$fontFamily\"; font-size:${fontSize}pt; line-height:${lineHeight}; background-color:$backgroundHex;'>&nbsp;</div>" +
                    "</body></html>"
        }

        try {
            // Get the syntax highlighter for the file type
            val syntaxHighlighter =
                com.intellij.openapi.fileTypes.SyntaxHighlighterFactory.getSyntaxHighlighter(fileType, project, null)
                    ?: return createBasicHtml(
                        text,
                        fontFamily,
                        fontSize,
                        lineHeight,
                        scheme,
                        backgroundColor
                    ) // Updated call

            val lexer = syntaxHighlighter.highlightingLexer
            lexer.start(text)

            val highlightedText = StringBuilder()
            var lastOffset = 0

            while (lexer.tokenType != null) {
                val tokenStart = lexer.tokenStart
                val tokenEnd = lexer.tokenEnd
                val tokenType = lexer.tokenType
                val tokenText = text.substring(tokenStart, tokenEnd)

                // Add any text between tokens
                if (tokenStart > lastOffset) {
                    val defaultColor = scheme.defaultForeground
                    val defaultColorHex =
                        String.format("#%02x%02x%02x", defaultColor.red, defaultColor.green, defaultColor.blue)
                    highlightedText.append(
                        "<span style='color:$defaultColorHex'>${
                            escapeHtml(
                                text.substring(
                                    lastOffset,
                                    tokenStart
                                )
                            )
                        }</span>"
                    )
                }

                // Get TextAttributesKey from the syntax highlighter
                val textAttributesKeys = syntaxHighlighter.getTokenHighlights(tokenType)

                if (textAttributesKeys.isNotEmpty()) {
                    // Use the first (most specific) attributes key
                    val textAttributes = scheme.getAttributes(textAttributesKeys[0])
                    val color = textAttributes?.foregroundColor ?: scheme.defaultForeground

                    val colorHex = String.format("#%02x%02x%02x", color.red, color.green, color.blue)

                    var styledToken = "<span style='color:$colorHex"

                    // Add font style if needed
                    if (textAttributes != null && textAttributes.fontType != 0) {
                        if (textAttributes.fontType and Font.BOLD != 0) {
                            styledToken += "; font-weight:bold"
                        }
                        if (textAttributes.fontType and Font.ITALIC != 0) {
                            styledToken += "; font-style:italic"
                        }
                    }

                    styledToken += "'>${escapeHtml(tokenText)}</span>"
                    highlightedText.append(styledToken)
                } else {
                    // No specific highlighting, use default color
                    val defaultColor = scheme.defaultForeground
                    val defaultColorHex =
                        String.format("#%02x%02x%02x", defaultColor.red, defaultColor.green, defaultColor.blue)
                    highlightedText.append("<span style='color:$defaultColorHex'>${escapeHtml(tokenText)}</span>")
                }

                lastOffset = tokenEnd
                lexer.advance()
            }

            // Add any remaining text
            if (lastOffset < text.length) {
                val defaultColor = scheme.defaultForeground
                val defaultColorHex =
                    String.format("#%02x%02x%02x", defaultColor.red, defaultColor.green, defaultColor.blue)
                highlightedText.append("<span style='color:$defaultColorHex'>${escapeHtml(text.substring(lastOffset))}</span>")
            }

            val toReturn = "<html><body style='margin:0; padding:2px 6px; background-color:$backgroundHex;'>" +
                    "<div style='font-family:\"$fontFamily\"; font-size:${fontSize}pt; line-height:${lineHeight}; background-color:$backgroundHex;'>$highlightedText</div>" +
                    "</body></html>"
            return toReturn

        } catch (e: Exception) {
            println("DEBUG: Syntax highlighting failed: ${e.message}")
            return createBasicHtml(text, fontFamily, fontSize, lineHeight, scheme, backgroundColor) // Updated call
        }
    }

    private fun createBasicHtml(
        text: String,
        fontFamily: String,
        fontSize: Int,
        lineHeight: Float, // Added lineHeight parameter
        scheme: com.intellij.openapi.editor.colors.EditorColorsScheme,
        backgroundColor: Color
    ): String {
        val foregroundColor = scheme.defaultForeground
        val foregroundHex =
            String.format("#%02x%02x%02x", foregroundColor.red, foregroundColor.green, foregroundColor.blue)
        val backgroundHex =
            String.format("#%02x%02x%02x", backgroundColor.red, backgroundColor.green, backgroundColor.blue)

        return "<html><body style='margin:0; padding:2px 6px; background-color:$backgroundHex;'>" +
                "<div style='font-family:\"$fontFamily\"; font-size:${fontSize}pt; line-height:${lineHeight}; color:$foregroundHex; background-color:$backgroundHex;'>${
                    escapeHtml(
                        text
                    )
                }</div>" +
                "</body></html>"
    }

    private fun escapeHtml(text: String): String {
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#x27;")
            .replace(" ", "&nbsp;")
            .replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
    }

    // Then update getCurrentFileType to use it
    private fun getCurrentFileType(editor: Editor): FileType {
        // Method 1: Use the current editor's virtual file (most reliable)
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)
        virtualFile?.let { file ->
            return file.fileType
        }

        // Method 2: Try to get from FileEditorManager
        val fileEditorManager = com.intellij.openapi.fileEditor.FileEditorManager.getInstance(project)
        val currentFile = fileEditorManager.selectedFiles.firstOrNull()

        currentFile?.let { file ->
            return file.fileType
        }

        // Method 3: Fallback to plain text
        return FileTypeManager.getInstance().getFileTypeByExtension("txt")
    }

    private fun createBasicHighlightedHtml(text: String, font: java.awt.Font): String {
        if (text.trim()
                .isEmpty()
        ) return "<html><div style='font-family:${font.family}; font-size:${font.size}px; line-height:1.2; margin:0; padding:2px 4px;'>&nbsp;</div></html>"

        // Basic syntax highlighting patterns (you can extend this)
        var highlightedText = text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace(" ", "&nbsp;") // Preserve spaces
            .replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;") // Convert tabs to spaces

        // Simple keyword highlighting (extend based on your needs)
        val keywords = arrayOf(
            "function", "const", "let", "var", "return", "if", "else", "for", "while",
            "class", "public", "private", "static", "void", "int", "String", "boolean",
            "def", "import", "from", "as", "try", "except", "finally", "with"
        )

        keywords.forEach { keyword ->
            highlightedText = highlightedText.replace(
                Regex("\\b$keyword\\b"),
                "<span style='color:#569CD6'>$keyword</span>"
            )
        }

        // String highlighting
        highlightedText = highlightedText.replace(
            Regex("\"([^\"]*)\"|'([^']*)'"),
            "<span style='color:#CE9178'>$0</span>"
        )

        // Comment highlighting
        highlightedText = highlightedText.replace(
            Regex("//.*$", RegexOption.MULTILINE),
            "<span style='color:#6A9955'>$0</span>"
        )

        // Use div instead of pre for better control over spacing
        return "<html><div style='font-family:${font.family}; font-size:${font.size}px; line-height:1.2; margin:0; padding:0; white-space:nowrap;'>$highlightedText</div></html>"
    }

    private fun addKeyboardShortcuts(panel: JComponent, onAction: (PopupAction) -> Unit) {
        // CRITICAL FIX: Disable focus traversal for Tab key
        panel.setFocusTraversalKeysEnabled(false)

        val inputMap = panel.getInputMap(JComponent.WHEN_FOCUSED)
        val actionMap = panel.actionMap

        // Add Tab key for accept
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "accept")
        actionMap.put("accept", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                onAction(PopupAction.ACCEPT)
            }
        })

        // Add Esc key for reject
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "reject")
        actionMap.put("reject", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                onAction(PopupAction.REJECT)
            }
        })

        panel.isFocusable = true
    }

    private fun renderDeletionDecorations(
        editor: Editor,
        oldCode: String,
        newCode: String,
        startLine: Int
    ) {
        // Clear any existing decorations first
        clearAllDeletionDecorations()

        val diffChars = calculateCharDiff(oldCode, newCode)

        deletionHighlighters = diffChars.filter { it.type == "old" }.map { diff ->
            val lineStartOffset = editor.document.getLineStartOffset(startLine + diff.oldLineIndex!!)
            val startOffset = lineStartOffset + diff.oldCharIndexInLine!!
            val endOffset = startOffset + diff.char.length

            editor.markupModel.addRangeHighlighter(
                startOffset,
                endOffset,
                HighlighterLayer.SELECTION - 1,
                TextAttributes().apply {
                    backgroundColor =
                        JBColor.namedColor("Editor.DiffDeletedLines.background", JBColor(0xFFE6E6, 0x484A4A))
                    effectType = EffectType.STRIKEOUT
                    effectColor = JBColor.namedColor("Editor.DiffDeletedLines.border", JBColor(0xD32F2F, 0xB71C1C))
                },
                HighlighterTargetArea.EXACT_RANGE
            )
        }
    }

    private fun calculateCharDiff(oldCode: String, newCode: String): List<DiffChar> {
        // This is a simplified diff implementation
        // For a production-ready solution, consider adding a proper diff library like java-diff-utils

        val result = mutableListOf<DiffChar>()

        // Track indices as we process the diff
        var oldIndex = 0
        var newIndex = 0
        var oldLineIndex = 0
        var newLineIndex = 0
        var oldCharIndexInLine = 0
        var newCharIndexInLine = 0

        // Convert strings to character arrays for easier processing
        val oldChars = oldCode.toCharArray()
        val newChars = newCode.toCharArray()

        var i = 0
        var j = 0

        // Simple longest common subsequence approach
        while (i < oldChars.size || j < newChars.size) {
            when {
                i < oldChars.size && j < newChars.size && oldChars[i] == newChars[j] -> {
                    // Characters match - mark as "same"
                    val char = oldChars[i].toString()

                    result.add(
                        DiffChar(
                            type = "same",
                            char = char,
                            oldIndex = oldIndex,
                            newIndex = newIndex,
                            oldLineIndex = oldLineIndex,
                            newLineIndex = newLineIndex,
                            oldCharIndexInLine = oldCharIndexInLine,
                            newCharIndexInLine = newCharIndexInLine
                        )
                    )

                    // Update indices
                    oldIndex++
                    newIndex++

                    if (char == "\n") {
                        oldLineIndex++
                        newLineIndex++
                        oldCharIndexInLine = 0
                        newCharIndexInLine = 0
                    } else {
                        oldCharIndexInLine++
                        newCharIndexInLine++
                    }

                    i++
                    j++
                }

                i < oldChars.size && (j >= newChars.size || shouldDeleteChar(oldChars, newChars, i, j)) -> {
                    // Character exists in old but not in new - mark as "old"
                    val char = oldChars[i].toString()

                    result.add(
                        DiffChar(
                            type = "old",
                            char = char,
                            oldIndex = oldIndex,
                            oldLineIndex = oldLineIndex,
                            oldCharIndexInLine = oldCharIndexInLine
                        )
                    )

                    // Update old indices only
                    oldIndex++
                    if (char == "\n") {
                        oldLineIndex++
                        oldCharIndexInLine = 0
                    } else {
                        oldCharIndexInLine++
                    }

                    i++
                }

                j < newChars.size -> {
                    // Character exists in new but not in old - mark as "new"
                    val char = newChars[j].toString()

                    result.add(
                        DiffChar(
                            type = "new",
                            char = char,
                            newIndex = newIndex,
                            newLineIndex = newLineIndex,
                            newCharIndexInLine = newCharIndexInLine
                        )
                    )

                    // Update new indices only
                    newIndex++
                    if (char == "\n") {
                        newLineIndex++
                        newCharIndexInLine = 0
                    } else {
                        newCharIndexInLine++
                    }

                    j++
                }
            }
        }

        return result
    }

    // Helper function to determine if a character should be considered deleted
    // This is a simplified heuristic - a proper diff algorithm would be more sophisticated
    private fun shouldDeleteChar(oldChars: CharArray, newChars: CharArray, i: Int, j: Int): Boolean {
        if (j >= newChars.size) return true

        // Look ahead a few characters to see if we can find a match
        val lookAhead = minOf(5, oldChars.size - i, newChars.size - j)
        for (k in 1..lookAhead) {
            if (i + k < oldChars.size && oldChars[i] == newChars[j + k]) {
                return false // Found a match ahead, so insert new chars first
            }
            if (j + k < newChars.size && oldChars[i + k] == newChars[j]) {
                return true // Found a match ahead, so delete old char first
            }
        }

        return true // Default to deletion
    }

    private fun acceptEdit(
        editor: Editor,
        newText: String,
        startLine: Int,
        endLine: Int,
        isLineDelete: Boolean = false
    ) {
        isAccepted = true

        // Clear handler before making document changes that move cursor
        clearActiveHandler()

        hideAllNextEditWindows()

        try {
            // Fix: Use the simpler WriteCommandAction.runWriteCommandAction
            WriteCommandAction.runWriteCommandAction(project) {
                val document = editor.document

                // Validate line indices
                val totalLines = document.lineCount

                if (startLine < 0 || startLine >= totalLines) {
                    return@runWriteCommandAction
                }

                if (endLine < 0 || endLine >= totalLines) {
                    return@runWriteCommandAction
                }

                if (isLineDelete) {
                    // Handle line deletion - include the newline character
                    val startOffset = document.getLineStartOffset(startLine)
                    var endOffset: Int

                    // If this isn't the last line, extend to include the newline character
                    if (startLine < document.lineCount - 1) {
                        endOffset = document.getLineStartOffset(startLine + 1)
                    } else {
                        // If it's the last line, just delete to end of line
                        endOffset = document.getLineEndOffset(startLine)
                    }

                    val oldText = document.getText(TextRange(startOffset, endOffset))

                    // Delete the entire line including newline
                    document.deleteString(startOffset, endOffset)

                } else {
                    // Handle normal text replacement
                    val startOffset = document.getLineStartOffset(startLine)
                    val endOffset = document.getLineEndOffset(endLine)

                    if (startOffset < 0 || endOffset > document.textLength || startOffset > endOffset) {
                        return@runWriteCommandAction
                    }

                    // Show what we're replacing
                    val oldText = document.getText(TextRange(startOffset, endOffset))

                    // Perform the replacement
                    document.replaceString(startOffset, endOffset, newText)
                }
            }

            coroutineScope.launch(Dispatchers.EDT) {
                InlineCompletionUtils.triggerInlineCompletion(
                    editor,
                    project
                )
            }
        } catch (e: Exception) {
            println("ERROR: Exception in acceptEdit: ${e.message}")
            e.printStackTrace()
        }

        // Log acceptance (placeholder)
        currentCompletionId?.let {
            // project.getService(NextEditService::class.java).acceptEdit(it)
        }

        isAccepted = false
    }

    private fun rejectEdit() {
        clearActiveHandler()

        hideAllNextEditWindows()

        // Log rejection and delete chain (placeholder)
        currentCompletionId?.let {
            // project.getService(NextEditService::class.java).rejectEdit(it)
        }
    }

    fun hideAllNextEditWindows() {
        currentPopup?.let { popup ->
            // Clear keyboard shortcuts before closing popup
            val content = popup.content
            if (content is JComponent) {
                content.inputMap.clear()
                content.actionMap.clear()
            }

            popup.cancel()
            currentPopup = null
        }

        // Clear all deletion decorations without tracking editors
        clearAllDeletionDecorations()
        deletionHighlighters = emptyList()

        clearActiveHandler() // TODO: might be redundant
    }

    private fun clearAllDeletionDecorations() {
        // Remove highlighters using their dispose method - they know which editor they belong to
        deletionHighlighters.forEach { highlighter ->
            try {
                highlighter.dispose()
            } catch (e: Exception) {
                // Highlighter might already be disposed, ignore
            }
        }
    }

    private fun clearActiveHandler() {
        windowHandler?.let { handler ->
            val activeHandlerManager = project.getService(ActiveHandlerManager::class.java)
            activeHandlerManager.clearActiveHandler()
            handler.dispose()
        }
        windowHandler = null
    }

    fun hasAccepted(): Boolean = isAccepted

    fun setAccepted(accepted: Boolean) {
        isAccepted = accepted
    }

    fun updateCurrentCompletionId(completionId: String) {
        currentCompletionId = completionId
    }

    fun cleanup() {
        hideAllNextEditWindows()
        currentCompletionId = null
    }
}

enum class PopupAction {
    ACCEPT,
    REJECT
}

data class DiffChar(
    val type: String, // "old", "new", "same"
    val char: String,
    val oldIndex: Int? = null, // Character index assuming a flattened line string
    val newIndex: Int? = null,
    val oldLineIndex: Int? = null, // Line index
    val newLineIndex: Int? = null,
    val oldCharIndexInLine: Int? = null, // Character index within the line
    val newCharIndexInLine: Int? = null
)