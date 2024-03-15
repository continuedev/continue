package com.github.continuedev.continueintellijextension.autocomplete

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorCustomElementRenderer
import com.intellij.openapi.editor.Inlay
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.editor.impl.FontInfo
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.ui.Gray
import com.intellij.ui.JBColor
import java.awt.Color
import java.awt.Font
import java.awt.Graphics
import java.awt.Rectangle
import kotlin.math.ceil

class ContinueCustomElementRenderer (
        val editor: Editor,
        val text: String,
) : EditorCustomElementRenderer {
    override fun calcWidthInPixels(inlay: Inlay<*>): Int {
        return (inlay.editor as EditorImpl).getFontMetrics(Font.PLAIN).stringWidth(this.text)
    }

    protected val font: Font
        get() {
            val editorFont = editor.colorsScheme.getFont(EditorFontType.PLAIN)
            return editorFont.deriveFont(Font.ITALIC) ?: editorFont
        }

    private fun offsetY(): Int {
        val metrics =
                FontInfo.getFontMetrics(font, FontInfo.getFontRenderContext(editor.contentComponent))
        val fontHeight =
                font.createGlyphVector(metrics.fontRenderContext, text).visualBounds.height
        val height = (editor.lineHeight + fontHeight) / 2
        return ceil(height).toInt()
    }

    override fun paint(inlay: Inlay<*>, g: Graphics, targetRegion: Rectangle, textAttributes: TextAttributes) {
        g.color = JBColor.GRAY
        g.font = font
        g.drawString(this.text, targetRegion.x, targetRegion.y + offsetY())
    }
}