import com.github.continuedev.continueintellijextension.actions.FocusActionUtil
import com.github.continuedev.continueintellijextension.editor.openInlineEdit
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.ui.components.JBPanel
import java.awt.*
import java.awt.event.ActionEvent
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.awt.geom.RoundRectangle2D
import java.util.*
import javax.swing.JButton

class StyledButton(text: String) : JButton(text) {
    private var isHovered = false
    private val editorBackground: Color

    init {
        border = null
        isContentAreaFilled = false
        isFocusPainted = false
        cursor = Cursor(Cursor.HAND_CURSOR)

        val scheme = EditorColorsManager.getInstance().globalScheme
        val editorFont = scheme.getFont(EditorFontType.PLAIN)
        val editorFontSize = editorFont.size

        font = font.deriveFont(editorFontSize.toFloat() * 0.75f)

        editorBackground = scheme.defaultBackground

        addMouseListener(object : MouseAdapter() {
            override fun mouseEntered(e: MouseEvent) {
                isHovered = true
                repaint()
            }

            override fun mouseExited(e: MouseEvent) {
                isHovered = false
                repaint()
            }
        })
    }


    override fun paintComponent(g: Graphics) {
        val g2 = g.create() as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val width = width.toFloat()
        val height = height.toFloat()
        val arc = 6f

        // Draw semi-transparent background
        g2.color = editorBackground
        g2.fill(RoundRectangle2D.Float(0f, 0f, width, height, arc, arc))

        // Draw border
        g2.color = if (isHovered) foreground else foreground.darker()
        g2.stroke = BasicStroke(1f)
        g2.draw(RoundRectangle2D.Float(0.5f, 0.5f, width - 1f, height - 1f, arc, arc))

        super.paintComponent(g)
        g2.dispose()
    }
}


class ToolTipComponent(editor: Editor, x: Int, y: Int) :
    JBPanel<ToolTipComponent>() {
    private var addToChatButton: StyledButton
    private var editButton: StyledButton

    init {
        layout = null // Remove the FlowLayout

        // Make the background transparent
        isOpaque = false
        background = Color(0, 0, 0, 0)

        val cmdCtrlChar =
            if (System.getProperty("os.name").lowercase(Locale.getDefault()).contains("mac")) "⌘" else "Ctrl"

        val buttonHeight = 16
        val buttonHorizontalPadding = 2
        val buttonVerticalPadding = 2
        val componentHorizontalPadding = 4
        val buttonMargin = 4

        addToChatButton = StyledButton("Chat (${cmdCtrlChar}+J)")
        editButton = StyledButton("Edit (${cmdCtrlChar}+I)")

        addToChatButton.addActionListener { e: ActionEvent? ->
            FocusActionUtil.sendHighlightedCodeWithMessageToWebview(editor.project, "focusContinueInputWithNewSession")
            editor.contentComponent.remove(this)
        }
        editButton.addActionListener { e: ActionEvent? ->
            openInlineEdit(editor.project, editor)
            editor.contentComponent.remove(this)
        }


        // Calculate button widths
        val addToChatWidth = addToChatButton.preferredSize.width + (2 * buttonHorizontalPadding)
        val editWidth = editButton.preferredSize.width + (2 * buttonHorizontalPadding)

        // Set bounds for buttons
        addToChatButton.setBounds(componentHorizontalPadding, buttonVerticalPadding, addToChatWidth, buttonHeight)
        editButton.setBounds(
            componentHorizontalPadding + addToChatWidth + buttonMargin,
            buttonVerticalPadding,
            editWidth,
            buttonHeight
        )

        add(addToChatButton)
        add(editButton)

        val totalWidth = addToChatWidth + editWidth + buttonMargin + (2 * componentHorizontalPadding)
        val totalHeight = buttonHeight + (2 * buttonVerticalPadding)

        // Center the component on the provided y coordinate
        val yPosition = y - (totalHeight / 2)
        setBounds(x, yPosition, totalWidth, totalHeight)
    }
}
