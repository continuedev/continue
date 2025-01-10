package com.github.continuedev.continueintellijextension.autocomplete

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorCustomElementRenderer
import com.intellij.openapi.editor.Inlay
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.ui.JBColor
import com.intellij.util.ui.UIUtil
import java.awt.Font
import java.awt.Graphics
import java.awt.Rectangle

/**
 * The `ContinueInlayRenderer` class is responsible for rendering custom inlay elements within an editor.
 * It implements the [EditorCustomElementRenderer] interface to provide custom rendering logic for inlays.
 *
 * This renderer is designed to display a list of text lines (`lines`) within the editor, calculating the
 * necessary width and height based on the content and rendering each line with appropriate font and color.
 *
 * @author lk
 */
class ContinueInlayRenderer(val lines: List<String>) : EditorCustomElementRenderer {
    override fun calcWidthInPixels(inlay: Inlay<*>): Int {
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
        return (inlay.editor as EditorImpl).lineHeight * lines.size
    }

    private fun font(editor: Editor): Font {
        val editorFont = editor.colorsScheme.getFont(EditorFontType.PLAIN)
        return UIUtil.getFontWithFallbackIfNeeded(editorFont, lines.joinToString("\n"))
            .deriveFont(editor.colorsScheme.editorFontSize)
    }

    override fun paint(inlay: Inlay<*>, g: Graphics, targetRegion: Rectangle, textAttributes: TextAttributes) {
        val editor = inlay.editor
        g.color = JBColor.GRAY
        g.font = font(editor)
        var additionalYOffset = 0
        val ascent = editor.ascent
        val lineHeight = editor.lineHeight
        for (line in lines) {
            g.drawString(line, targetRegion.x, targetRegion.y + ascent + additionalYOffset)
            additionalYOffset += lineHeight
        }
    }
}