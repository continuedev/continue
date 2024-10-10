package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.utils.getAltKeyLabel
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.ui.JBColor
import java.awt.*
import javax.swing.JButton

class VerticalDiffActionButtons(
    private val editor: Editor,
    var line: Int,
    private val numRed: Int,
    private val numGreen: Int,
    private val onClick: (Boolean, Int, Int, Int) -> Unit
) {
    val acceptButton: JButton
    val rejectButton: JButton

    fun removeButtons() {
        editor.contentComponent.remove(acceptButton)
        editor.contentComponent.remove(rejectButton)
        editor.contentComponent.revalidate()
        editor.contentComponent.repaint()
    }

    init {
        acceptButton = createButton("${getAltKeyLabel()}⇧Y", JBColor(0x9900FF00.toInt(), 0x9900FF00.toInt()))
        rejectButton = createButton("${getAltKeyLabel()}⇧N", JBColor(0x99FF0000.toInt(), 0x99FF0000.toInt()))

        acceptButton.addActionListener {
            onClick(true, line, numGreen, numRed)
        }

        rejectButton.addActionListener {
            onClick(false, line, numGreen, numRed)
        }

        val (x, y) = getXYPosition()

        rejectButton.setBounds(
            x,
            y,
            rejectButton.preferredSize.width,
            rejectButton.preferredSize.height
        )

        acceptButton.setBounds(
            x + rejectButton.preferredSize.width + 5,
            y,
            acceptButton.preferredSize.width,
            acceptButton.preferredSize.height
        )
    }

    private fun getXYPosition(): Pair<Int, Int> {
        val visibleArea = editor.scrollingModel.visibleArea
        val lineStartPosition = editor.logicalPositionToXY(LogicalPosition(line, 0))
        val xPosition =
            visibleArea.x + visibleArea.width - acceptButton.preferredSize.width - rejectButton.preferredSize.width - 20
        val yPosition = lineStartPosition.y
        return Pair(xPosition, yPosition)
    }

    private fun createButton(text: String, backgroundColor: JBColor): JButton {
        return object : JButton(text) {
            override fun paintComponent(g: Graphics) {
                val g2 = g.create() as Graphics2D
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
                g2.color = backgroundColor
                g2.fillRoundRect(0, 0, width - 1, height - 1, 8, 8)
                super.paintComponent(g2)
                g2.dispose()
            }
        }.apply {
            // This isn't working currently, font color is transparent
            foreground = JBColor.WHITE
            font = Font("Arial", Font.BOLD, 9)
            isContentAreaFilled = false
            isOpaque = false
            border = null
            preferredSize = Dimension(preferredSize.width, 16)
            cursor = Cursor(Cursor.HAND_CURSOR)
        }
    }

    fun updatePosition(newLineNumber: Int) {
        line = newLineNumber

        val (x, y) = getXYPosition()

        acceptButton.location = Point(x, y)
        rejectButton.location = Point(x + acceptButton.width + 5, y)

        // Refresh the editor to reflect the changes
        editor.component.repaint()
    }
}
