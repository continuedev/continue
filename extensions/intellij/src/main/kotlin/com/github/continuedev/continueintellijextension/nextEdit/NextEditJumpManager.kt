package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.listeners.ActiveHandlerManager
import com.github.continuedev.continueintellijextension.utils.InlineCompletionUtils
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.ScrollType
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopup
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.util.TextRange
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.util.ui.JBFont
import com.intellij.util.ui.JBUI
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.awt.*
import java.awt.event.ActionEvent
import java.awt.event.KeyEvent
import java.awt.geom.RoundRectangle2D
import javax.swing.AbstractAction
import javax.swing.JComponent
import javax.swing.KeyStroke
import javax.swing.SwingUtilities
import javax.swing.border.AbstractBorder

data class CompletionDataForAfterJump(
    val completionId: String,
    val outcome: NextEditOutcome,
    val position: LogicalPosition
)

@Service(Service.Level.PROJECT)
class NextEditJumpManager(private val project: Project) {

    private val coroutineScope = CoroutineScope(Dispatchers.Main)

    // State management
    private var jumpState = JumpState()

    // Handler management
    private var jumpHandler: NextEditJumpHandler? = null

    // UI components
    private var jumpPopup: JBPopup? = null
    private var editorHighlighter: RangeHighlighter? = null
    private var keyboardShortcutsPanel: JComponent? = null

    // Callbacks
    private var triggerInlineSuggestCallback: (() -> Unit)? = null
    private var deleteChainCallback: (() -> Unit)? = null

    private data class JumpState(
        val inProgress: Boolean = false,
        val justAccepted: Boolean = false,
        val jumpPosition: LogicalPosition? = null,
        val editor: Editor? = null,
        val oldCursorPosition: LogicalPosition? = null,
        val completionAfterJump: CompletionDataForAfterJump? = null
    )

    init {
//        registerSelectionChangeHandler()
    }

    // Public API
    fun isJumpInProgress(): Boolean = jumpState.inProgress

    fun setJumpInProgress(jumpInProgress: Boolean) {
        jumpState = jumpState.copy(inProgress = jumpInProgress)
    }

    fun wasJumpJustAccepted(): Boolean = jumpState.justAccepted

    fun setTriggerInlineSuggestCallback(callback: () -> Unit) {
        triggerInlineSuggestCallback = callback
    }

    fun setDeleteChainCallback(callback: () -> Unit) {
        deleteChainCallback = callback
    }

    fun setCompletionAfterJump(completionData: CompletionDataForAfterJump) {
        jumpState = jumpState.copy(completionAfterJump = completionData)
    }

    fun clearSavedCompletionAfterJump() {
        jumpState = jumpState.copy(completionAfterJump = null)
    }

    fun getSavedCompletionAfterJump(): CompletionDataForAfterJump? = jumpState.completionAfterJump

    fun getJumpPosition(): LogicalPosition? = jumpState.jumpPosition

    fun getOriginalPosition(): LogicalPosition? = jumpState.oldCursorPosition

    fun abortJump() {
        // Public method that delegates to the existing private rejectJump logic
        rejectJump()
    }

    // Main entry point
    suspend fun suggestJump(
        editor: Editor,
        currentPosition: LogicalPosition,
        nextJumpLocation: LogicalPosition,
        completionContent: String? = null
    ): Boolean {
        // Skip if content is identical at jump location
        if (completionContent != null &&
            isContentIdentical(editor, nextJumpLocation, completionContent)
        ) {
            println("Skipping jump as content is identical at jump location")
            return false
        }

        println("Suggesting jump from line ${currentPosition.line} to line ${nextJumpLocation.line}")

        // Update state
        jumpState = jumpState.copy(
            inProgress = true,
            jumpPosition = nextJumpLocation,
            editor = editor,
            oldCursorPosition = currentPosition
        )

        // Register active handler to track cursor movements during jump
        jumpHandler = NextEditJumpHandler(project, this)
        val activeHandlerManager = project.getService(ActiveHandlerManager::class.java)
        activeHandlerManager.setActiveHandler(jumpHandler!!)

        // Show UI - ensure this runs on EDT
        return try {
            var result = false
            ApplicationManager.getApplication().invokeAndWait {
                try {
                    showJumpDecoration(editor, nextJumpLocation)

                    // Scroll to show jump location
                    editor.scrollingModel.scrollTo(nextJumpLocation, ScrollType.CENTER)

                    result = true
                    println("DEBUG: suggestJump completed successfully")
                } catch (e: Exception) {
                    println("DEBUG: Error in suggestJump UI operations: $e")
                    // Reset state on error
                    jumpState = jumpState.copy(inProgress = false)
                    result = false
                }
            }
            result
        } catch (e: Exception) {
            println("DEBUG: Error in suggestJump invokeAndWait: $e")
            // Reset state on error
            jumpState = jumpState.copy(inProgress = false)
            false
        }
    }

    // Private implementation
    private fun showJumpDecoration(editor: Editor, position: LogicalPosition) {
        clearJumpDecoration()

        // Add editor highlight
        val markupModel = editor.markupModel
        val lineStartOffset = editor.document.getLineStartOffset(position.line)
        val lineEndOffset = editor.document.getLineEndOffset(position.line)

        editorHighlighter = markupModel.addRangeHighlighter(
            lineStartOffset,
            lineEndOffset,
            HighlighterLayer.SELECTION - 1,
            TextAttributes().apply {
                backgroundColor = JBColor.namedColor("InfoPopup.background", JBColor(0xE6F3FF, 0x2D3142))
            },
            HighlighterTargetArea.LINES_IN_RANGE
        )

        // Show popup with keyboard shortcuts
        showJumpPopup(editor, position)
    }

    private fun showJumpPopup(editor: Editor, position: LogicalPosition) {
        val popupComponent = createJumpPopupComponent(editor)

        jumpPopup = JBPopupFactory.getInstance()
            .createComponentPopupBuilder(popupComponent, popupComponent)
            .setFocusable(true)
            .setRequestFocus(true)
            .setResizable(false)
            .setMovable(false)
            .setCancelOnClickOutside(false)
            .setCancelOnWindowDeactivation(false)
            .setCancelKeyEnabled(false)
            .setCancelCallback {
                if (jumpState.inProgress && !jumpState.justAccepted) {
                    rejectJump()
                }
                true
            }
            .createPopup()

        // Show popup and ensure focus
        ApplicationManager.getApplication().invokeLater {
            try {
                val lineEndOffset = editor.document.getLineEndOffset(position.line)
                val lineEndPoint = editor.offsetToXY(lineEndOffset)
                val editorComponent = editor.contentComponent

                // Calculate the vertical center of the line
                val lineHeight = editor.lineHeight
                val lineCenterY = lineEndPoint.y + (lineHeight / 2)

                // Get the popup's preferred size to calculate its center
                val popupSize = popupComponent.preferredSize
                val popupCenterY = popupSize.height / 2

                // Position the popup so its center aligns with the line's center
                val adjustedY = lineCenterY - popupCenterY

                val screenPoint = Point(lineEndPoint.x + 20, adjustedY)
                SwingUtilities.convertPointToScreen(screenPoint, editorComponent)

                jumpPopup?.showInScreenCoordinates(editorComponent, screenPoint)

                val content = jumpPopup?.content
                if (content is JComponent) {
                    // Remove default border and add custom rounded border
                    content.border = object : AbstractBorder() {
                        override fun paintBorder(c: Component, g: Graphics, x: Int, y: Int, width: Int, height: Int) {
                            val g2 = g.create() as Graphics2D
                            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

                            val arc = 6f
                            // g2.color = JBColor.border()
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
                    println("DEBUG: Jump popup shown and focus requested")
                }
            } catch (e: Exception) {
                jumpPopup?.showInBestPositionFor(editor)
                ApplicationManager.getApplication().invokeLater {
                    popupComponent.requestFocusInWindow()
                }
            }
        }
    }

    private fun createJumpPopupComponent(editor: Editor): JComponent {
        val panel = object : JBPanel<JBPanel<*>>() {
            private val arc = 6f

            init {
                isOpaque = false
                background = JBColor.namedColor("InfoPopup.background", JBColor(0xE6F3FF, 0x2D3142))
            }

            override fun paintComponent(g: Graphics) {
                val g2 = g.create() as Graphics2D
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

                val width = width.toFloat()
                val height = height.toFloat()

                // Draw background with rounded corners
                g2.color = background
                g2.fill(RoundRectangle2D.Float(0f, 0f, width, height, arc, arc))

                // Draw border with the SAME dimensions as the background
                g2.color = JBColor.border()
                g2.stroke = BasicStroke(1f)
                g2.draw(RoundRectangle2D.Float(0f, 0f, width, height, arc, arc))

                g2.dispose()
                super.paintComponent(g)
            }
        }.apply {
            layout = BorderLayout()
            border = JBUI.Borders.empty(2, 4)
        }

        // Create the message label
        val message = "📍 Press Tab to jump, Esc to cancel"
        val label = JBLabel(message).apply {
            foreground = JBColor.foreground()
            background = JBColor.namedColor("InfoPopup.background", JBColor(0xE6F3FF, 0x2D3142))
            isOpaque = true
            font = JBFont.small()
        }

        panel.add(label, BorderLayout.CENTER)

        // Add keyboard shortcuts to the panel
        addKeyboardShortcuts(panel, editor)

        // Store reference for cleanup
        keyboardShortcutsPanel = panel

        return panel
    }

    private fun addKeyboardShortcuts(panel: JComponent, editor: Editor) {
        println("DEBUG: Adding keyboard shortcuts to jump panel")

        // CRITICAL: Disable focus traversal for Tab key
        panel.setFocusTraversalKeysEnabled(false)

        val inputMap = panel.getInputMap(JComponent.WHEN_FOCUSED)
        val actionMap = panel.actionMap

        // Add Tab key for accept
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "acceptJump")
        actionMap.put("acceptJump", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                println("DEBUG: Accept jump action triggered!")
                acceptJump(editor)
            }
        })

        // Add Esc key for reject
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "rejectJump")
        actionMap.put("rejectJump", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                println("DEBUG: Reject jump action triggered!")
                rejectJump()
            }
        })

        panel.isFocusable = true

        // Debug listeners
        panel.addFocusListener(object : java.awt.event.FocusListener {
            override fun focusGained(e: java.awt.event.FocusEvent?) {
                println("DEBUG: Jump panel gained focus")
            }

            override fun focusLost(e: java.awt.event.FocusEvent?) {
                println("DEBUG: Jump panel lost focus")
            }
        })

        panel.addKeyListener(object : java.awt.event.KeyListener {
            override fun keyPressed(e: KeyEvent?) {
                println("DEBUG: Jump panel key pressed: ${e?.keyCode} (Tab = ${KeyEvent.VK_TAB}, Esc = ${KeyEvent.VK_ESCAPE})")
            }

            override fun keyReleased(e: KeyEvent?) {}
            override fun keyTyped(e: KeyEvent?) {}
        })

        panel.addHierarchyListener { e ->
            if (e.changeFlags and java.awt.event.HierarchyEvent.SHOWING_CHANGED.toLong() != 0L) {
                if (panel.isShowing) {
                    println("DEBUG: Jump panel is showing, requesting focus")
                    ApplicationManager.getApplication().invokeLater {
                        val focusResult = panel.requestFocusInWindow()
                        println("DEBUG: Jump panel focus request result: $focusResult")
                    }
                }
            }
        }
    }

    private fun acceptJump(editor: Editor) {
        val state = jumpState
        if (!state.inProgress || state.jumpPosition == null || state.editor == null) {
            println("DEBUG: Cannot accept jump - invalid state: ${!state.inProgress} ${state.jumpPosition == null} ${state.editor == null}")
            return
        }

        println("Accepting jump to position: ${state.jumpPosition}")

        // Update state BEFORE clearing decorations to prevent cancel callback from triggering reject
        jumpState = jumpState.copy(justAccepted = true)

        ApplicationManager.getApplication().invokeLater {
            // Move cursor to jump position
            state.editor.caretModel.moveToLogicalPosition(state.jumpPosition)

            // Clear decorations (this will cancel popup, but won't trigger reject due to state check)
            clearJumpDecoration()

            InlineCompletionUtils.triggerInlineCompletion(editor, project) { success -> "success: $success" }

            // Reset accepted state after a brief moment
            coroutineScope.launch {
                kotlinx.coroutines.delay(100)
                jumpState = jumpState.copy(justAccepted = false)

                // Clear the active handler after jump is complete
                clearActiveHandler()

                // Trigger inline suggestion
                triggerInlineSuggestCallback?.invoke()
            }
        }
    }

    private fun rejectJump() {
        if (!jumpState.inProgress) {
            println("DEBUG: Cannot reject jump - not in progress")
            return
        }

        println("Rejecting jump - deleting chain")

        // Delete the chain
        deleteChainCallback?.invoke()

        // Clear state
        clearJumpState()

        // Clear handler when rejecting
        clearActiveHandler()
    }

    private fun clearJumpDecoration() {
        // Clear keyboard shortcuts first
        keyboardShortcutsPanel?.let { panel ->
            if (panel is JComponent) {
                panel.inputMap?.clear()
                panel.actionMap?.clear()
            }
        }
        keyboardShortcutsPanel = null

        // Cancel popup
        jumpPopup?.cancel()
        jumpPopup = null

        // Remove editor highlighter
        editorHighlighter?.let { highlighter ->
            jumpState.editor?.markupModel?.removeHighlighter(highlighter)
            editorHighlighter = null
        }
    }

    private fun clearJumpState() {
        clearJumpDecoration()
        jumpState = JumpState()
    }

    private fun isContentIdentical(
        editor: Editor,
        jumpLocation: LogicalPosition,
        completionContent: String
    ): Boolean {
        return try {
            val completionLines = completionContent.split("\n")
            val document = editor.document
            val startLine = jumpLocation.line
            val endLine = minOf(startLine + completionLines.size - 1, document.lineCount - 1)

            // Check if we have enough lines
            if (endLine - startLine + 1 < completionLines.size) {
                return false
            }

            // Compare line by line
            completionLines.indices.all { i ->
                val documentLine = startLine + i
                if (documentLine >= document.lineCount) return@all false

                val lineStartOffset = document.getLineStartOffset(documentLine)
                val lineEndOffset = document.getLineEndOffset(documentLine)
                val lineText = document.getText(TextRange(lineStartOffset, lineEndOffset))

                lineText == completionLines[i]
            }
        } catch (error: Exception) {
            println("Error checking content at jump location: $error")
            false
        }
    }

//    private fun registerSelectionChangeHandler() {
//        val selectionManager = project.getService(SelectionChangeManager::class.java)
//
//        selectionManager.registerListener(
//            "nextEditJumpManager",
//            { event, state -> handleSelectionChange(event, state) },
//            HandlerPriority.HIGH
//        )
//    }
//
//    private suspend fun handleSelectionChange(
//        event: SelectionEvent,
//        state: StateSnapshot
//    ): Boolean {
//        // Preserve chain during jump operations
//        when {
//            state.jumpInProgress -> {
//                println("Jump in progress, preserving chain")
//
//                // Check if cursor moved away from expected position
//                val currentPos = event.editor.caretModel.logicalPosition
//                val oldPos = jumpState.oldCursorPosition
//                val jumpPos = jumpState.jumpPosition
//
//                // If cursor moved but not to jump position, reject the jump
//                if (oldPos != null && jumpPos != null &&
//                    !currentPos.equals(oldPos) && !currentPos.equals(jumpPos)
//                ) {
//                    println("DEBUG: Cursor moved unexpectedly, rejecting jump")
//                    rejectJump()
//                }
//
//                return true
//            }
//
//            state.jumpJustAccepted -> {
//                println("Jump just accepted, preserving chain")
//                return true
//            }
//
//            else -> return false
//        }
//    }

    fun cleanup() {
        clearJumpState()
        triggerInlineSuggestCallback = null
        deleteChainCallback = null
    }

    private fun clearActiveHandler() {
        jumpHandler?.let { handler ->
            val activeHandlerManager = project.getService(ActiveHandlerManager::class.java)
            activeHandlerManager.clearActiveHandler()
            handler.dispose()
        }
        jumpHandler = null
    }
}