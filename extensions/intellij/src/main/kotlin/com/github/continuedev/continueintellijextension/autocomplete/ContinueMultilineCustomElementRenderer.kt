package com.github.continuedev.continueintellijextension.autocomplete

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorCustomElementRenderer
import com.intellij.openapi.editor.Inlay
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.editor.impl.FontInfo
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.ui.JBColor
import com.intellij.util.ui.UIUtil
import java.awt.Font
import java.awt.Graphics
import java.awt.Rectangle
import kotlin.math.ceil
import kotlin.math.max

class ContinueMultilineCustomElementRenderer(
    val editor: Editor,
    val text: String,
) : EditorCustomElementRenderer {
    override fun calcWidthInPixels(inlay: Inlay<*>): Int {
        val lines = text.lines()
        var maxLen = 0;
        for (line in lines) {
            val len = (inlay.editor as EditorImpl).getFontMetrics(Font.PLAIN).stringWidth(line)
            if (len > maxLen) {
                maxLen = len
            }
        }
        return maxLen
    }

    override fun calcHeightInPixels(inlay: Inlay<*>): Int {
        return (inlay.editor as EditorImpl).lineHeight * text.lines().size
    }

    protected val font: Font
        get() {
            val editorFont = editor.colorsScheme.getFont(EditorFontType.PLAIN)
            return UIUtil.getFontWithFallbackIfNeeded(editorFont, text).deriveFont(editor.colorsScheme.editorFontSize)
        }

    private fun offsetY(): Int {
        val metrics =
            FontInfo.getFontMetrics(font, FontInfo.getFontRenderContext(editor.contentComponent))
        val fontHeight =
            font.createGlyphVector(metrics.fontRenderContext, text).visualBounds.height
        val height = (editor.lineHeight + fontHeight) / 2
        return ceil(height).toInt()
    }

    private fun offsetX(): Int {
        val currentLine = editor.caretModel.primaryCaret.logicalPosition.line
        val currentColumn = editor.caretModel.primaryCaret.logicalPosition.column
        val metrics =
            FontInfo.getFontMetrics(font, FontInfo.getFontRenderContext(editor.contentComponent))
        val fontWidth =
            font.createGlyphVector(metrics.fontRenderContext, text).visualBounds.width
        val widthBeforeCaret = (editor as EditorImpl).getFontMetrics(Font.PLAIN).stringWidth(
            text.substring(0, minOf(currentColumn, text.length))
        )
        return max(0, widthBeforeCaret - (editor as EditorImpl).scrollingModel.horizontalScrollOffset)
    }

    override fun paint(inlay: Inlay<*>, g: Graphics, targetRegion: Rectangle, textAttributes: TextAttributes) {
        g.color = JBColor.GRAY
        g.font = font
        var additionalYOffset = -editor.lineHeight;
        var isFirstLine = true
        for (line in text.lines()) {
            g.drawString(
                line,
                if (isFirstLine) targetRegion.x + offsetX() else targetRegion.x,
                targetRegion.y + inlay.editor.ascent + additionalYOffset
            )
            additionalYOffset += editor.lineHeight
            isFirstLine = false
        }
    }
}