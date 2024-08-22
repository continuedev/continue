import com.github.continuedev.continueintellijextension.actions.focusContinueInput
import com.github.continuedev.continueintellijextension.editor.openInlineEdit
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.ui.components.JBPanel
import java.awt.*
import java.awt.event.ActionEvent
import java.util.*
import javax.swing.JButton
import java.awt.geom.RoundRectangle2D

class StyledButton(text: String, foregroundColor: Color) : JButton(text) {
    init {
        cursor = Cursor(Cursor.HAND_CURSOR)
        isOpaque = false
        isContentAreaFilled = false
        isFocusPainted = false
        border = null // Remove the border
        foreground = foregroundColor
    }

    override fun paintComponent(g: Graphics) {
        val g2 = g.create() as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val arc = 24f // Corner radius
        val padding = 0f
        val x = padding
        val y = padding
        val w = (width - 2 * padding)
        val h = (height - 2 * padding)

        // Draw flat background
//        g2.color = if (model.isPressed) Color(70, 70, 70) else Color(100, 100, 100)
//        g2.fill(RoundRectangle2D.Float(x, y, w, h, arc, arc))

        // Draw border
//        g2.color = Color(120, 120, 120)
//        g2.draw(RoundRectangle2D.Float(x, y, w - 1, h - 1, arc, arc))

        g2.dispose()

        super.paintComponent(g)
    }
}

class ToolTipComponent(editor: Editor, x: Int, y: Int) :
    JBPanel<ToolTipComponent>() {
    private var addToChatButton: StyledButton
    private var editButton: StyledButton
    private var backgroundColor: Color
    private var foregroundColor: Color

    init {
        layout = null // Remove the FlowLayout

        val globalScheme = EditorColorsManager.getInstance().globalScheme
        backgroundColor = globalScheme.defaultBackground
        foregroundColor = Color(
            globalScheme.defaultForeground.red,
            globalScheme.defaultForeground.green,
            globalScheme.defaultForeground.blue,
            200
        )

        val cmdCtrlChar = if (System.getProperty("os.name").lowercase(Locale.getDefault()).contains("mac")) "⌘" else "Ctrl"
        addToChatButton = StyledButton("${cmdCtrlChar}J Chat", foregroundColor)
        editButton = StyledButton("${cmdCtrlChar}I Edit", foregroundColor)

        addToChatButton.addActionListener { e: ActionEvent? ->
            focusContinueInput(editor.project)
            editor.contentComponent.remove(this)
        }
        editButton.addActionListener { e: ActionEvent? ->
            openInlineEdit(editor.project, editor)
            editor.contentComponent.remove(this)
        }

        // Set bounds for buttons to remove spacing
        addToChatButton.setBounds(0, 0, addToChatButton.preferredSize.width, addToChatButton.preferredSize.height)
        editButton.setBounds(addToChatButton.preferredSize.width, 0, editButton.preferredSize.width, editButton.preferredSize.height)

        add(addToChatButton)
        add(editButton)

        val totalWidth = addToChatButton.preferredSize.width + editButton.preferredSize.width
        val totalHeight = addToChatButton.preferredSize.height
        setBounds(x, y, totalWidth, totalHeight)

        // Make the background transparent
        isOpaque = false
        background = Color(0, 0, 0, 0)
    }

    override fun paintComponent(g: Graphics) {
        val arc = 12f

        val g2 = g.create() as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        // Draw rounded rectangle background
        g2.color = backgroundColor
        g2.fill(RoundRectangle2D.Float(0f, 0f, width.toFloat(), height.toFloat(), arc, arc))

        // Draw rounded rectangle border
        g2.color = Color(120, 120, 120)
        val strokeWidth = 1.0f
        g2.stroke = BasicStroke(1.0f)
        g2.draw(RoundRectangle2D.Float(0f, 0f, width.toFloat() - strokeWidth, height.toFloat() - strokeWidth, arc, arc))

        // Draw border between buttons
        g2.color = Color(120, 120, 120)
        g2.stroke = BasicStroke(1.0f)
        val middleX = addToChatButton.width.toFloat()
        g2.drawLine(middleX.toInt(), 0, middleX.toInt(), height)

        g2.dispose()
        super.paintComponent(g)
    }
}
