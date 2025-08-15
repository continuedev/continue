package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.listeners.ActiveHandlerManager
import com.github.continuedev.continueintellijextension.utils.InlineCompletionUtils
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.markup.*
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopup
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.util.TextRange
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.event.ActionEvent
import java.awt.event.KeyEvent
import javax.swing.*

@Service(Service.Level.PROJECT)
class NextEditWindowManager(private val project: Project) {
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
        println("DEBUG: showNextEditWindow called with:")
        println("  currCursorPos: $currCursorPos")
        println("  editableRegionStartLine: $editableRegionStartLine")
        println("  editableRegionEndLine: $editableRegionEndLine")
        println("  oldCode length: ${oldCode.length}")
        println("  newCode length: ${newCode.length}")
        println("  document total lines: ${editor.document.lineCount}")
        println("  document writable: ${editor.document.isWritable}")

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

        println("DEBUG: isLineDelete: $isLineDelete")

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
        val popupComponent = createNextEditPopupComponent(code, diffLines, onAction)

        val popup = JBPopupFactory.getInstance()
            .createComponentPopupBuilder(popupComponent, popupComponent) // Set focus component
            .setFocusable(true)
            .setRequestFocus(true)
            .setResizable(false)
            .setMovable(false)
            .setCancelOnClickOutside(false)
            .setCancelOnWindowDeactivation(false)
            .setCancelKeyEnabled(false) // Disable default Esc handling to use our custom one
            .setCancelCallback {
                onAction(PopupAction.REJECT)
                true
            }
            .createPopup()

        currentPopup = popup

        // Show popup and ensure focus
        ApplicationManager.getApplication().invokeLater {
            try {
                val caretPosition = editor.caretModel.primaryCaret.logicalPosition
                val caretPoint = editor.logicalPositionToXY(caretPosition)
                val editorComponent = editor.contentComponent
                val screenPoint = java.awt.Point(caretPoint.x + 20, caretPoint.y + editor.lineHeight)
                javax.swing.SwingUtilities.convertPointToScreen(screenPoint, editorComponent)

                popup.showInScreenCoordinates(editorComponent, screenPoint)

                // Force focus after popup is shown
                ApplicationManager.getApplication().invokeLater {
                    popupComponent.requestFocusInWindow()
                    println("DEBUG: Popup shown and focus requested")
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
        code: String,
        diffLines: List<DiffLine>,
        onAction: (PopupAction) -> Unit
    ): JComponent {
        val panel = JBPanel<JBPanel<*>>().apply {
            layout = BorderLayout()
            border = JBUI.Borders.empty(8)
            background = EditorColorsManager.getInstance().globalScheme.defaultBackground
        }

        // Create syntax-highlighted code display
        val codePanel = createCodeDisplayPanel(code, diffLines)
        panel.add(codePanel, BorderLayout.CENTER)

        // Add keyboard shortcuts
        addKeyboardShortcuts(panel, onAction)

        return panel
    }

    private fun createCodeDisplayPanel(code: String, diffLines: List<DiffLine>): JComponent {
        val scheme = EditorColorsManager.getInstance().globalScheme

        // Use the editor's actual font settings
        val editorFont = scheme.getFont(EditorFontType.PLAIN)
        val fontSize = scheme.editorFontSize
        val actualFont = editorFont.deriveFont(fontSize.toFloat())

        // Get line spacing from editor settings
        val lineSpacing = scheme.lineSpacing
        val fontMetrics = java.awt.Toolkit.getDefaultToolkit().getFontMetrics(actualFont)
        val baseLineHeight = fontMetrics.height
        val actualLineHeight = (baseLineHeight * lineSpacing).toInt()

        val panel = JBPanel<JBPanel<*>>().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            background = scheme.defaultBackground
            border = JBUI.Borders.compound(
                JBUI.Borders.customLine(JBColor.border()),
                JBUI.Borders.empty(4)
            )
        }

        var maxWidth = 0

        // Filter out old lines and process only new and same lines from diffLines
        val visibleDiffLines = diffLines.filter { it.type != "old" }

        // Create all labels first to measure them properly
        val labels = mutableListOf<JBLabel>()

        visibleDiffLines.forEach { diffLine ->
            val displayText = diffLine.line.ifEmpty { " " }

            // Create HTML content for basic syntax highlighting
            val htmlContent = createBasicHighlightedHtml(displayText, actualFont)

            val label = JBLabel(htmlContent).apply {
                font = actualFont
                isOpaque = true

                when (diffLine.type) {
                    "new" -> {
                        // Highlight new additions
                        background = JBColor(0x2D4A2D, 0x2D4A2D) // Darker green
                        foreground = scheme.defaultForeground
                    }

                    else -> { // "same" or any other type
                        // Regular unchanged lines
                        background = scheme.defaultBackground
                        foreground = scheme.defaultForeground
                    }
                }

                // Match editor's text rendering
                alignmentX = JComponent.LEFT_ALIGNMENT
            }

            // Let the label calculate its own preferred size based on HTML content
            val labelPreferredSize = label.preferredSize
            maxWidth = maxOf(maxWidth, labelPreferredSize.width)

            // Set consistent height based on editor line height, but allow for HTML rendering
            val adjustedLineHeight = maxOf(actualLineHeight, labelPreferredSize.height)
            label.preferredSize = java.awt.Dimension(labelPreferredSize.width, adjustedLineHeight)
            label.maximumSize = java.awt.Dimension(Int.MAX_VALUE, adjustedLineHeight)

            labels.add(label)
            panel.add(label)
        }

        // Calculate dimensions based on actual label measurements
        val visibleLineCount = visibleDiffLines.size
        val borderInsets = panel.border?.getBorderInsets(panel) ?: java.awt.Insets(0, 0, 0, 0)

        // Use the actual measured max width plus some padding
        val contentWidth = maxWidth + borderInsets.left + borderInsets.right + 24 // More padding for HTML rendering

        // Calculate height based on actual label heights
        val totalLabelHeight = labels.sumOf { it.preferredSize.height }
        val contentHeight = totalLabelHeight + borderInsets.top + borderInsets.bottom + 16

        // Set reasonable bounds for the popup with generous sizing
//        val maxPopupWidth = 1200  // Increased to accommodate longer lines
//        val maxPopupHeight = 800  // Increased to show more content
//        val minPopupWidth = 500   // Increased minimum width
//        val minPopupHeight = maxOf(actualLineHeight * 2, 100) // Minimum 2 lines

//        val finalWidth = minOf(maxPopupWidth, maxOf(minPopupWidth, contentWidth))
//        val finalHeight = minOf(maxPopupHeight, maxOf(minPopupHeight, contentHeight))
        val finalWidth = contentWidth
        val finalHeight = contentHeight

        return JScrollPane(panel).apply {
            border = null
            preferredSize = java.awt.Dimension(finalWidth, finalHeight)

            // Only show scrollbars when actually needed
            horizontalScrollBarPolicy = if (contentWidth > finalWidth) {
                JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED
            } else {
                JScrollPane.HORIZONTAL_SCROLLBAR_NEVER
            }

            verticalScrollBarPolicy = if (contentHeight > finalHeight) {
                JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED
            } else {
                JScrollPane.VERTICAL_SCROLLBAR_NEVER
            }

            // Use editor's background color
            viewport.background = scheme.defaultBackground
            background = scheme.defaultBackground

            // Smooth scrolling like in editor
            viewport.scrollMode = javax.swing.JViewport.BACKINGSTORE_SCROLL_MODE

            // Match editor's scroll unit - use actual line height from labels
            val averageLineHeight = if (labels.isNotEmpty()) {
                labels.sumOf { it.preferredSize.height } / labels.size
            } else {
                actualLineHeight
            }
            verticalScrollBar.unitIncrement = averageLineHeight
            horizontalScrollBar.unitIncrement = fontMetrics.charWidth(' ') * 4
        }
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
        return "<html><div style='font-family:${font.family}; font-size:${font.size}px; line-height:1.2; margin:0; padding:2px 4px; white-space:nowrap;'>$highlightedText</div></html>"
    }

    private fun addKeyboardShortcuts(panel: JComponent, onAction: (PopupAction) -> Unit) {
        println("DEBUG: Adding keyboard shortcuts to panel")

        // CRITICAL FIX: Disable focus traversal for Tab key
        panel.setFocusTraversalKeysEnabled(false)

        val inputMap = panel.getInputMap(JComponent.WHEN_FOCUSED)
        val actionMap = panel.actionMap

        // Add Tab key for accept
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "accept")
        actionMap.put("accept", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                println("DEBUG: Accept action triggered!")
                onAction(PopupAction.ACCEPT)
            }
        })

        // Add Esc key for reject
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "reject")
        actionMap.put("reject", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                println("DEBUG: Reject action triggered!")
                onAction(PopupAction.REJECT)
            }
        })

        panel.isFocusable = true

        // Keep your existing debug listeners
        panel.addFocusListener(object : java.awt.event.FocusListener {
            override fun focusGained(e: java.awt.event.FocusEvent?) {
                println("DEBUG: Panel gained focus")
            }

            override fun focusLost(e: java.awt.event.FocusEvent?) {
                println("DEBUG: Panel lost focus")
            }
        })

        panel.addKeyListener(object : java.awt.event.KeyListener {
            override fun keyPressed(e: KeyEvent?) {
                println("DEBUG: Key pressed: ${e?.keyCode} (Tab = ${KeyEvent.VK_TAB})")
            }

            override fun keyReleased(e: KeyEvent?) {}
            override fun keyTyped(e: KeyEvent?) {}
        })

        panel.addHierarchyListener { e ->
            if (e.changeFlags and java.awt.event.HierarchyEvent.SHOWING_CHANGED.toLong() != 0L) {
                if (panel.isShowing) {
                    println("DEBUG: Panel is showing, requesting focus")
                    ApplicationManager.getApplication().invokeLater {
                        val focusResult = panel.requestFocusInWindow()
                        println("DEBUG: Focus request result: $focusResult")
                    }
                }
            }
        }
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
        println("DEBUG: acceptEdit called with:")
        println("  newText: '$newText'")
        println("  startLine: $startLine")
        println("  endLine: $endLine")
        println("  isLineDelete: $isLineDelete")

        isAccepted = true

        // Clear handler before making document changes that move cursor
        clearActiveHandler()

        hideAllNextEditWindows()

        try {
            // Fix: Use the simpler WriteCommandAction.runWriteCommandAction
            WriteCommandAction.runWriteCommandAction(project) {
                println("DEBUG: Inside WriteCommandAction")
                val document = editor.document

                // Validate line indices
                val totalLines = document.lineCount
                println("DEBUG: Total lines in document: $totalLines")

                if (startLine < 0 || startLine >= totalLines) {
                    println("ERROR: Invalid startLine $startLine (total lines: $totalLines)")
                    return@runWriteCommandAction
                }

                if (endLine < 0 || endLine >= totalLines) {
                    println("ERROR: Invalid endLine $endLine (total lines: $totalLines)")
                    return@runWriteCommandAction
                }

                if (isLineDelete) {
                    // Handle line deletion - include the newline character
                    val startOffset = document.getLineStartOffset(startLine)
                    var endOffset: Int

                    // If this isn't the last line, extend to include the newline character
                    if (startLine < document.lineCount - 1) {
                        endOffset = document.getLineStartOffset(startLine + 1)
                        println("DEBUG: Line delete - including newline, endOffset: $endOffset")
                    } else {
                        // If it's the last line, just delete to end of line
                        endOffset = document.getLineEndOffset(startLine)
                        println("DEBUG: Line delete - last line, endOffset: $endOffset")
                    }

                    println("DEBUG: Line deletion offsets:")
                    println("  startOffset: $startOffset")
                    println("  endOffset: $endOffset")

                    val oldText = document.getText(TextRange(startOffset, endOffset))
                    println("DEBUG: Deleting text: '$oldText'")

                    // Delete the entire line including newline
                    document.deleteString(startOffset, endOffset)
                    println("DEBUG: Line deletion completed")

                } else {
                    // Handle normal text replacement
                    val startOffset = document.getLineStartOffset(startLine)
                    val endOffset = document.getLineEndOffset(endLine)

                    println("DEBUG: Normal edit offsets:")
                    println("  startOffset: $startOffset")
                    println("  endOffset: $endOffset")
                    println("  document length: ${document.textLength}")

                    if (startOffset < 0 || endOffset > document.textLength || startOffset > endOffset) {
                        println("ERROR: Invalid offsets - startOffset: $startOffset, endOffset: $endOffset, docLength: ${document.textLength}")
                        return@runWriteCommandAction
                    }

                    // Show what we're replacing
                    val oldText = document.getText(TextRange(startOffset, endOffset))
                    println("DEBUG: Replacing text:")
                    println("  Old: '$oldText'")
                    println("  New: '$newText'")

                    // Perform the replacement
                    document.replaceString(startOffset, endOffset, newText)
                    println("DEBUG: Document replacement completed")
                }
            }

            println("DEBUG: WriteCommandAction completed successfully")
            InlineCompletionUtils.triggerInlineCompletion(
                editor,
                project
            ) { success -> println("invocation: $success") }
        } catch (e: Exception) {
            println("ERROR: Exception in acceptEdit: ${e.message}")
            e.printStackTrace()
        }

        // Log acceptance (placeholder)
        currentCompletionId?.let {
            println("DEBUG: Would log acceptance for completion ID: $it")
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

//    fun registerSelectionChangeHandler() {
//        val selectionManager = project.getService(SelectionChangeManager::class.java)
//
//        selectionManager.registerListener(
//            "nextEditWindowManager",
//            { event, state ->
//                handleSelectionChange(event, state)
//            },
//            HandlerPriority.HIGH
//        )
//    }
//
//    private suspend fun handleSelectionChange(
//        event: SelectionEvent,
//        state: StateSnapshot
//    ): Boolean {
//        // If window was just accepted, preserve the chain
//        if (state.nextEditWindowAccepted) {
//            println("Next edit window accepted, preserving chain")
//            return true
//        }
//
//        return false
//    }
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