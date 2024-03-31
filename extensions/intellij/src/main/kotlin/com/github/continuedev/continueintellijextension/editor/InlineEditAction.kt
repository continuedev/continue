package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.`continue`.GetTheme
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.util.Ref
import com.intellij.openapi.util.TextRange
import com.intellij.util.ui.UIUtil
import net.miginfocom.swing.MigLayout
import java.awt.*
import java.awt.event.ComponentAdapter
import java.awt.event.ComponentEvent
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import javax.swing.JPanel
import javax.swing.JTextArea
import kotlin.math.max

/**
 * Adapted from https://github.com/cursive-ide/component-inlay-example/blob/master/src/main/kotlin/inlays/InlineEditAction.kt
 */
class InlineEditAction : AnAction(), DumbAware {
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = true
        e.presentation.isVisible = true
    }

//    private var preloadedBrowser: ContinueBrowser? = null

    override fun actionPerformed(e: AnActionEvent) {
        if (e.project == null) return
//        if (this.preloadedBrowser == null) {
//            this.preloadedBrowser = ContinueBrowser(e.project!!,
////                    "http://continue/editorInset/index.html", true)
//                    "http://localhost:5173/jetbrains_editorInset_index.html", true)
//        }

        val editor = e.getData(PlatformDataKeys.EDITOR) ?: return
        val project = e.getData(PlatformDataKeys.PROJECT) ?: return
        val manager = EditorComponentInlaysManager.from(editor)

        // Get highlighted range
        val selectionModel = editor.selectionModel
        val start = selectionModel.selectionStart
        val end = selectionModel.selectionEnd
        val prefix = editor.document.getText(TextRange(0, start))
        val highlighted = editor.document.getText(TextRange(start, end))
        val suffix = editor.document.getText(TextRange(end, editor.document.textLength))

        val startLineNum = editor.document.getLineNumber(start)
        val endLineNum = editor.document.getLineNumber(end)
        val lineNumber = max(0, startLineNum - 1)

        // Un-highlight the selected text
        selectionModel.removeSelection()

        // Get indentation width in pixels
        val indentationLineNum = lineNumber + 1
        val lineStart = editor.document.getLineStartOffset(indentationLineNum)
        val lineEnd = editor.document.getLineEndOffset(indentationLineNum)
        val text = editor.document.getText(TextRange(lineStart, lineEnd))
        val indentation = text.takeWhile { it == ' ' }.length
        val charWidth = editor.contentComponent.getFontMetrics(editor.colorsScheme.getFont(EditorFontType.PLAIN)).charWidth(' ')
        val leftInset = indentation * charWidth * 2 / 3

        val inlayRef = Ref<Disposable>()
        val textArea = makeTextArea(inlayRef) { input ->
            val diffStreamHandler = DiffStreamHandler(project, editor, startLineNum, endLineNum)
            diffStreamHandler.run(input, prefix, highlighted, suffix)
        }
        val panel = makePanel(textArea, inlayRef, leftInset)
        val inlay = manager.insertAfter(lineNumber, panel)
        panel.revalidate()
        inlayRef.set(inlay)
        val viewport = (editor as? EditorImpl)?.scrollPane?.viewport
        viewport?.dispatchEvent(ComponentEvent(viewport, ComponentEvent.COMPONENT_RESIZED))

        textArea.requestFocus()

        // Set focus to the editor's browser component
//        preloadedBrowser?.browser?.component?.requestFocus()
//
//        preloadedBrowser?.onHeightChange {
//            viewport?.dispatchEvent(ComponentEvent(viewport, ComponentEvent.COMPONENT_RESIZED))
//        }

//        preloadedBrowser?.sendToWebview("jetbrains/editorInsetRefresh", null)
        // Set timeout
//        Thread.sleep(3000)
//        preloadedBrowser?.sendToWebview("jetbrains/editorInsetRefresh", null)
    }

    fun makeTextArea(inlayRef: Ref<Disposable>, onEnter: (input: String) -> Unit): JTextArea {
        val textArea = CustomTextArea( 2, 40).apply {
            lineWrap = true
            wrapStyleWord = true
            isOpaque = false
            background = GetTheme().getSecondaryDark()
            maximumSize = Dimension(400, Short.MAX_VALUE.toInt())
            margin = Insets(8, 8, 8, 8)
            font = Font("Arial", Font.PLAIN, 14)
        }
        textArea.putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)

        textArea.addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                if (e.keyCode == KeyEvent.VK_ESCAPE) {
                    inlayRef.get().dispose()
                } else if (e.keyCode == KeyEvent.VK_ENTER) {
                    if (e.modifiersEx == KeyEvent.SHIFT_DOWN_MASK) {
                        textArea.document.insertString(textArea.caretPosition, "\n", null)
                    } else if (e.modifiersEx == 0) {
                        onEnter(textArea.text)
                        e.consume()
                    }
                }
            }
        })
        return textArea
    }

    fun makePanel(textArea: JTextArea, inlayRef: Ref<Disposable>, leftInset: Int): JPanel {
//        val browser = preloadedBrowser?.browser ?: return JPanel()
//        browser.component.preferredSize = browser.component.preferredSize.apply {
//            height = 60
//        }
//        browser.component.putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)
//        preloadedBrowser?.onHeightChange { height ->
//            browser.component.preferredSize = browser.component.preferredSize.apply {
////                this.height = height
//                // Refresh
////                browser.component.revalidate()
////                browser.component.repaint()
////
////                // Refresh the panel
////                panel.revalidate()
////                panel.repaint()
//            }
//        }

        val panel = JPanel(MigLayout("wrap 1, insets 10 $leftInset 4 4, gap 0!, fillx")).apply {
            // Transparent background
            val globalScheme = EditorColorsManager.getInstance().globalScheme
            val defaultBackground = globalScheme.defaultBackground
            background = defaultBackground
            add(textArea, "grow, gap 0!, height 100%")
//            add(browser.component, "grow, gap 0!")
            putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)
            preferredSize = textArea.preferredSize
        }
        panel.isOpaque = false

        textArea.addComponentListener(object : ComponentAdapter() {
            override fun componentResized(e: ComponentEvent?) {
                panel.revalidate()
                panel.repaint()
            }
        })


        return panel
    }
}

class CustomTextArea(rows: Int, columns: Int) : JTextArea(rows, columns) {
    override fun paintComponent(g: Graphics) {
        val g2 = g as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        // Fill the background with the desired color
        g2.color = background
        g2.fillRoundRect(0, 0, width - 1, height - 1, 15, 15)

        // Draw the box shadow
//        val shadowColor = Color(0, 0, 0, 100) // Change this to your desired shadow color and opacity
//        val shadowOffset = 5 // Change this to your desired shadow offset
//        val shadowSize = 10 // Change this to your desired shadow size
//
//        g2.color = shadowColor
//        g2.fillRoundRect(
//                shadowOffset,
//                shadowOffset,
//                width - shadowOffset * 2,
//                height - shadowOffset * 2,
//                15,
//                15
//        )

        // Draw placeholder
        if (getText().isEmpty()) {
            g.setColor(Color(128, 128, 128, 200))
            g.drawString("Enter instructions to edit highlighted code", 8, 21);
        }

        // Draw the rounded border
        val borderColor = Color(128, 128, 128, 128)
        val borderThickness = 1
        val borderRadius = 8

        g2.color = borderColor
        g2.stroke = BasicStroke(borderThickness.toFloat())
        g2.drawRoundRect(
                borderThickness / 2,
                borderThickness / 2,
                width - borderThickness - 1,
                height - borderThickness - 1,
                borderRadius,
                borderRadius
        )

        super.paintComponent(g)
    }
}