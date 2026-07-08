package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.listeners.ActiveHandlerManager
import com.github.continuedev.continueintellijextension.utils.InlineCompletionUtils
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.EDT
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
import kotlinx.coroutines.SupervisorJob
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

    private val coroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    // State management
    private var jumpState = JumpState()

    // Handler management
    private var jumpHandler: NextEditJumpHandler? = null

    // UI components
    private var jumpPopup: JBPopup? = null
    private var editorHighlighter: RangeHighlighter? = null
    private var keyboardShortcutsPanel: JComponent? = null

    private data class JumpState(
        val inProgress: Boolean = false,
        val justAccepted: Boolean = false,
        val jumpPosition: LogicalPosition? = null,
        val editor: Editor? = null,
        val oldCursorPosition: LogicalPosition? = null,
        val completionAfterJump: CompletionDataForAfterJump? = null
    )

    // Public API
    fun isJumpInProgress(): Boolean = jumpState.inProgress

    fun setJumpInProgress(jumpInProgress: Boolean) {
        jumpState = jumpState.copy(inProgress = jumpInProgress)
    }

    fun wasJumpJustAccepted(): Boolean = jumpState.justAccepted

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
    fun suggestJump(
        editor: Editor,
        currentPosition: LogicalPosition,
        nextJumpLocation: LogicalPosition,
        completionContent: String? = null
    ): Boolean {
        // Skip if content is identical at jump location
        if (completionContent != null &&
            isContentIdentical(editor, nextJumpLocation, completionContent)
        ) {
            return false
        }

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

                    result = true
                } catch (e: Exception) {
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
                backgroundColor = JBColor.namedColor(
                    "InfoPopup.background",
                    JBColor(
                        0xE6F3FF,
                        0x2D3142
                    )
                )
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
            .setModalContext(true)
            .setCancelCallback {
                if (jumpState.inProgress && !jumpState.justAccepted) {
                    rejectJump()
                }
                true
            }
            .createPopup()

        jumpPopup?.content?.addFocusListener(object : java.awt.event.FocusAdapter() {
            override fun focusLost(e: java.awt.event.FocusEvent?) {
                if (e?.isTemporary == false && jumpPopup?.isVisible == true && jumpState.inProgress && !jumpState.justAccepted) {
                    ApplicationManager.getApplication().invokeLater {
                        if (jumpPopup?.isVisible == true && !jumpPopup!!.isDisposed) {
                            popupComponent.requestFocusInWindow()
                        }
                    }
                }
            }
        })

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
                            g2.color = JBColor(Color(0x666667), Color(0x999998))
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
        panel.setFocusTraversalKeysEnabled(false)

        val inputMap = panel.getInputMap(JComponent.WHEN_FOCUSED)
        val actionMap = panel.actionMap

        // Add Tab key for accept
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "acceptJump")
        actionMap.put("acceptJump", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                acceptJump(editor)
            }
        })

        // Add Esc key for reject
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "rejectJump")
        actionMap.put("rejectJump", object : AbstractAction() {
            override fun actionPerformed(e: ActionEvent?) {
                rejectJump()
            }
        })

        panel.isFocusable = true
    }

    private fun acceptJump(editor: Editor) {
        val state = jumpState
        if (!state.inProgress || state.jumpPosition == null || state.editor == null) {
            return
        }

        // Update state BEFORE clearing decorations to prevent cancel callback from triggering reject
        jumpState = jumpState.copy(justAccepted = true)

        ApplicationManager.getApplication().invokeLater {
            // Move cursor to jump position
            state.editor.caretModel.moveToLogicalPosition(state.jumpPosition)

            // Scroll to show jump location
            editor.scrollingModel.scrollTo(state.jumpPosition, ScrollType.CENTER)

            // Clear decorations (this will cancel popup, but won't trigger reject due to state check)
            clearJumpDecoration()

            coroutineScope.launch(Dispatchers.EDT) {
                InlineCompletionUtils.triggerInlineCompletion(editor, project)
            }

            // Reset accepted state after a brief moment
            coroutineScope.launch {
                kotlinx.coroutines.delay(100)
                jumpState = jumpState.copy(justAccepted = false)

                // Clear the active handler after jump is complete
                clearActiveHandler()
            }
        }
    }

    private fun rejectJump() {
        if (!jumpState.inProgress) {
            return
        }

        // Clear state
        clearJumpState()

        // Clear handler when rejecting
        clearActiveHandler()
    }

    private fun clearJumpDecoration() {
        // Clear keyboard shortcuts first
        keyboardShortcutsPanel?.let { panel ->
            panel.inputMap?.clear()
            panel.actionMap?.clear()
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

    private fun clearActiveHandler() {
        jumpHandler?.let { handler ->
            val activeHandlerManager = project.getService(ActiveHandlerManager::class.java)
            activeHandlerManager.clearActiveHandler()
            handler.dispose()
        }
        jumpHandler = null
    }
}