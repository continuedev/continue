import com.github.continuedev.continueintellijextension.actions.focusContinueInput
import com.github.continuedev.continueintellijextension.editor.openInlineEdit
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.colors.EditorColors
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.ui.components.JBPanel
import java.awt.*
import java.awt.event.ActionEvent
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.util.*
import javax.swing.JButton
import java.awt.geom.RoundRectangle2D

class StyledButton(text: String, foregroundColor: Color, backgroundColor: Color) : JButton(text) {
    private var isHovered = false
    private val borderColor: Color
    private val hoverBackgroundColor: Color
    private val hoverForegroundColor: Color
    private val originalForegroundColor: Color

    init {
        cursor = Cursor(Cursor.HAND_CURSOR)
        isOpaque = false
        isContentAreaFilled = false
        isFocusPainted = false
        border = null
        foreground = foregroundColor
        background = Color(backgroundColor.red, backgroundColor.green, backgroundColor.blue, 0)

        // Store the original foreground color
        originalForegroundColor = foregroundColor

        // Calculate colors for different states
        borderColor = Color(foregroundColor.red, foregroundColor.green, foregroundColor.blue, 40) // More subtle border
        hoverBackgroundColor = Color(backgroundColor.red, backgroundColor.green, backgroundColor.blue, 40)
        hoverForegroundColor = Color(
            foregroundColor.red,
            foregroundColor.green,
            foregroundColor.blue,
            160
        )

        // Get the editor font and its size
        val scheme = EditorColorsManager.getInstance().globalScheme
        val editorFont = scheme.getFont(EditorFontType.PLAIN)
        val editorFontSize = editorFont.size

        // Set the button's font to be slightly smaller than the editor
        font = font.deriveFont(editorFontSize.toFloat() * 0.75f)

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
        val arc = 4f

        // Draw button background
        g2.color = if (isHovered) hoverBackgroundColor else background
        g2.fill(RoundRectangle2D.Float(0f, 0f, width, height, arc, arc))

        // Draw border
        g2.color = if (isHovered) hoverForegroundColor else borderColor
        g2.draw(RoundRectangle2D.Float(0.5f, 0.5f, width - 1f, height - 1f, arc, arc))

        g2.dispose()

        // Set text color
        foreground = if (isHovered) hoverForegroundColor else originalForegroundColor

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

        // Get the selection background color
        backgroundColor = globalScheme.getColor(EditorColors.SELECTION_BACKGROUND_COLOR)
            ?: globalScheme.defaultBackground

        foregroundColor = Color(
            globalScheme.defaultForeground.red,
            globalScheme.defaultForeground.green,
            globalScheme.defaultForeground.blue,
            200
        )

        val cmdCtrlChar =
            if (System.getProperty("os.name").lowercase(Locale.getDefault()).contains("mac")) "⌘" else "Ctrl"

        val buttonHeight = 16 // Reduced height
        val buttonHorizontalPadding = 2 // Reduced horizontal padding inside buttons
        val buttonVerticalPadding = 2 // Vertical padding above and below buttons
        val componentHorizontalPadding = 4 // Padding on the left and right of the component
        val buttonMargin = 4 // New margin between buttons



        addToChatButton = StyledButton("Chat (${cmdCtrlChar}J)", foregroundColor, backgroundColor)
        editButton = StyledButton("Edit (${cmdCtrlChar}I)", foregroundColor, backgroundColor)

        addToChatButton.addActionListener { e: ActionEvent? ->
            focusContinueInput(editor.project)
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

        // Make the background transparent
        isOpaque = false
        background = Color(0, 0, 0, 0)
    }
}
