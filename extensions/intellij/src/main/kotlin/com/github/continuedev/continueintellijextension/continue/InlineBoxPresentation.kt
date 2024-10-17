package com.github.continuedev.continueintellijextension.`continue`

import com.intellij.codeInsight.hints.presentation.BasePresentation
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.markup.TextAttributes
import java.awt.*

internal class InlineBoxPresentation(private val editor: Editor) : BasePresentation() {
    override val height: Int = 50
    override val width: Int = 200
    
    override fun paint(g: Graphics2D, attributes: TextAttributes) {
        val color = attributes.foregroundColor
        val text = "Hello World!"
        g.color = color
        g.drawString(text, 0, 0)
    }

    override fun toString(): String = "InlineBoxPresentation"

}