import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.ui.components.JBPanel
import java.awt.event.ActionEvent
import java.util.*
import javax.swing.JButton

class ToolTipComponent(editor: Editor, line: Int, column: Int) :
    JBPanel<ToolTipComponent>() {
    init {
        val cmdCtrlChar = if (System.getProperty("os.name").lowercase(Locale.getDefault()).contains("mac")) "⌘" else "Ctrl"

        layout = null // Remove the FlowLayout
        val addToChatButton = JButton("${cmdCtrlChar}J Add to chat")
        val editButton = JButton("${cmdCtrlChar}I Edit")
        addToChatButton.addActionListener { e: ActionEvent? -> println("Add to chat button clicked") }
        editButton.addActionListener { e: ActionEvent? -> println("Edit button clicked") }

        // Set cursor to pointer for both buttons
        addToChatButton.cursor = java.awt.Cursor(java.awt.Cursor.HAND_CURSOR)
        editButton.cursor = java.awt.Cursor(java.awt.Cursor.HAND_CURSOR)

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
        addToChatButton.isOpaque = false
        editButton.isOpaque = false
    }
}