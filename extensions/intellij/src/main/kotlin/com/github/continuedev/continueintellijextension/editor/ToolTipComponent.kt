import com.github.continuedev.continueintellijextension.actions.FocusContinueInputWithoutClearAction
import com.github.continuedev.continueintellijextension.actions.focusContinueInput
import com.github.continuedev.continueintellijextension.editor.openInlineEdit
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.actionSystem.ex.ActionUtil.invokeAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBPanel
import java.awt.event.ActionEvent
import java.util.*
import javax.swing.JButton
import java.awt.Cursor

import javax.swing.BorderFactory
import java.awt.Color
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.geom.RoundRectangle2D

class StyledButton(text: String) : JButton(text) {
    init {
        cursor = Cursor(Cursor.HAND_CURSOR)
        isOpaque = false
        isContentAreaFilled = false
        isFocusPainted = false
        border = BorderFactory.createEmptyBorder(5, 10, 5, 10)
        foreground = Color.WHITE
    }

    override fun paintComponent(g: Graphics) {
        val g2 = g.create() as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val width = width
        val height = height
        val arc = 15

        // Draw flat background
        g2.color = if (model.isPressed) Color(70, 70, 70) else Color(100, 100, 100)
        g2.fill(RoundRectangle2D.Float(0f, 0f, width.toFloat(), height.toFloat(), arc.toFloat(), arc.toFloat()))

        // Draw border
        g2.color = Color(120, 120, 120)
        g2.draw(RoundRectangle2D.Float(0f, 0f, width.toFloat() - 1, height.toFloat() - 1, arc.toFloat(), arc.toFloat()))

        g2.dispose()

        super.paintComponent(g)
    }
}


class ToolTipComponent(editor: Editor, line: Int, column: Int) :
    JBPanel<ToolTipComponent>() {
    init {
        layout = null // Remove the FlowLayout

        val cmdCtrlChar = if (System.getProperty("os.name").lowercase(Locale.getDefault()).contains("mac")) "⌘" else "Ctrl"
        val addToChatButton = StyledButton("${cmdCtrlChar}J Add to chat")
        val editButton = StyledButton("${cmdCtrlChar}I Edit")

        addToChatButton.addActionListener { e: ActionEvent? -> focusContinueInput(editor.project) }
        editButton.addActionListener { e: ActionEvent? -> openInlineEdit(editor.project, editor) }

        // Calculate total width of both buttons
        val totalWidth = addToChatButton.preferredSize.width + editButton.preferredSize.width

        // Set bounds for buttons
        addToChatButton.setBounds(0, 0, addToChatButton.preferredSize.width, addToChatButton.preferredSize.height)
        editButton.setBounds(addToChatButton.preferredSize.width, 0, editButton.preferredSize.width, editButton.preferredSize.height)

        add(addToChatButton)
        add(editButton)

        val pos = LogicalPosition(line, column)
        val y: Int = editor.logicalPositionToXY(pos).y + editor.lineHeight
        val x: Int = editor.logicalPositionToXY(pos).x
        setBounds(x, y, totalWidth, addToChatButton.preferredSize.height)

        // Make the background transparent
        isOpaque = false
        background = java.awt.Color(0, 0, 0, 0)
    }
}