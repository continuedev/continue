package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.`continue`.GetTheme
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.getAltKeyLabel
import com.google.gson.Gson
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Ref
import com.intellij.openapi.util.TextRange
import com.intellij.ui.JBColor
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import net.miginfocom.swing.MigLayout
import org.jdesktop.swingx.JXPanel
import org.jdesktop.swingx.JXTextArea
import org.jdesktop.swingx.border.DropShadowBorder
import java.awt.*
import java.awt.event.*
import java.awt.geom.RoundRectangle2D
import javax.swing.*
import javax.swing.border.EmptyBorder
import javax.swing.event.DocumentEvent
import javax.swing.event.DocumentListener
import javax.swing.plaf.ComboBoxUI
import javax.swing.plaf.basic.BasicArrowButton
import javax.swing.plaf.basic.BasicComboBoxUI
import kotlin.math.max


const val SHADOW_SIZE = 7
const val MAIN_FONT_SIZE = 13

/**
 * Adapted from https://github.com/cursive-ide/component-inlay-example/blob/master/src/main/kotlin/inlays/InlineEditAction.kt
 */
class InlineEditAction : AnAction(), DumbAware {
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = true
        e.presentation.isVisible = true
    }

    override fun actionPerformed(e: AnActionEvent) {
        if (e.project == null) return

        val editor = e.getData(PlatformDataKeys.EDITOR) ?: return
        val project = e.getData(PlatformDataKeys.PROJECT) ?: return
        val manager = EditorComponentInlaysManager.from(editor)

        // Get list of model titles
        val continuePluginService = project.service<ContinuePluginService>()
        val modelTitles = mutableListOf<String>()
        continuePluginService.coreMessenger?.request("config/getBrowserSerialized", null, null) { response ->
            val gson = Gson()
            val config = gson.fromJson(response, Map::class.java)
            val models = config["models"] as List<Map<String, Any>>
            modelTitles.addAll(models.map { it["title"] as String })
        }
        val maxWaitTime = 200
        val startTime = System.currentTimeMillis()
        while (modelTitles.isEmpty() && System.currentTimeMillis() - startTime < maxWaitTime) {
            Thread.sleep(20)
        }

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
        val customPanelRef = Ref<CustomPanel>()

        // Create text area, attach key listener
        val textArea = makeTextArea()

        // Create diff stream handler
        val diffStreamHandler = DiffStreamHandler(project, editor, textArea, startLineNum, endLineNum, {
            inlayRef.get().dispose()
        }, {
            customPanelRef.get().finish()
        })
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.register(diffStreamHandler, editor)

        diffStreamHandler.setup()

        val comboBoxRef = Ref<JComboBox<String>>()

        fun onEnter() {
            customPanelRef.get().enter()
            diffStreamHandler.run(textArea.text, prefix, highlighted, suffix, comboBoxRef.get().selectedItem as String)
        }

        val panel = makePanel(project, customPanelRef, textArea, inlayRef, comboBoxRef, leftInset, modelTitles, {onEnter()}, {
            diffStreamService.reject(editor)
            selectionModel.setSelection(start, end)
        }, {
            diffStreamService.accept(editor)
            inlayRef.get().dispose()
        }, {
            diffStreamService.reject(editor)
            inlayRef.get().dispose()
        })
        val inlay = manager.insertAfter(lineNumber, panel)
        panel.revalidate()
        inlayRef.set(inlay)
        val viewport = (editor as? EditorImpl)?.scrollPane?.viewport
        viewport?.dispatchEvent(ComponentEvent(viewport, ComponentEvent.COMPONENT_RESIZED))

        // Add key listener to text area
        textArea.addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                if (e.keyCode == KeyEvent.VK_ESCAPE) {
                    diffStreamService.reject(editor)

                    // Re-highlight the selected text
                    selectionModel.setSelection(start, end)
                } else if (e.keyCode == KeyEvent.VK_ENTER) {
                    if (e.modifiersEx == KeyEvent.SHIFT_DOWN_MASK) {
                        textArea.document.insertString(textArea.caretPosition, "\n", null)
                    } else if (e.modifiersEx == 0) {
                        onEnter()
                        e.consume()
                    }
                }
            }
        })

        // Listen for changes to textarea line count
        textArea.document.addDocumentListener(object : DocumentListener {
            private var lastNumLines: Int = 0
            private fun updateSize() {
                val numLines = textArea.text.lines().size
                if (numLines != lastNumLines) {
                    lastNumLines = numLines
                    viewport?.dispatchEvent(ComponentEvent(viewport, ComponentEvent.COMPONENT_RESIZED))
                }
            }
            override fun insertUpdate(e: DocumentEvent?) {
                updateSize()
            }

            override fun removeUpdate(e: DocumentEvent?) {
                updateSize()
            }

            override fun changedUpdate(e: DocumentEvent?) {
                updateSize()
            }
        })


        textArea.requestFocus()
    }

    fun makeTextArea(): JTextArea {
        val textArea = CustomTextArea( 2, 40).apply {
            lineWrap = true
            wrapStyleWord = true
            isOpaque = false
            background = GetTheme().getSecondaryDark()
            maximumSize = Dimension(400, Short.MAX_VALUE.toInt())
            margin = JBUI.insets(8)
            font = Font("Arial", Font.PLAIN, MAIN_FONT_SIZE)
        }
        textArea.putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)

        return textArea
    }

    fun makePanel(project: Project, customPanelRef: Ref<CustomPanel>, textArea: JTextArea, inlayRef: Ref<Disposable>, comboBoxRef: Ref<JComboBox<String>>, leftInset: Int, modelTitles: List<String>, onEnter: () -> Unit, onCancel: () -> Unit, onAccept: () -> Unit, onReject: () -> Unit): JPanel {
        val topPanel = ShadowPanel(MigLayout("wrap 1, insets 4 $leftInset 2 2, gap 0!")).apply {
            val globalScheme = EditorColorsManager.getInstance().globalScheme
            val defaultBackground = globalScheme.defaultBackground
//            background = defaultBackground
            background =  JBColor(0x20888888.toInt(), 0x20888888.toInt())
            isOpaque = false
        }

        val panel = CustomPanel(MigLayout("wrap 1, insets 0, gap 0!, fillx"), project, modelTitles, comboBoxRef, onEnter, onCancel, onAccept, onReject).apply {
            val globalScheme = EditorColorsManager.getInstance().globalScheme
            val defaultBackground = globalScheme.defaultBackground
            background = defaultBackground
            add(textArea, "grow, gap 0!, height 100%")

            putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)
            preferredSize = textArea.preferredSize
            isOpaque = false
            setup()

            val shadow = DropShadowBorder()
            shadow.shadowColor = JBColor(0xb0b0b0, 0x505050)
            shadow.isShowRightShadow = true
            shadow.isShowBottomShadow = true
            shadow.shadowSize = SHADOW_SIZE
            border = shadow
        }
        customPanelRef.set(panel)

        textArea.addComponentListener(object : ComponentAdapter() {
            override fun componentResized(e: ComponentEvent?) {
                panel.revalidate()
                panel.repaint()
            }
        })

        topPanel.add(panel, "grow, gap 0!")

        return topPanel
    }
}

class CustomPanel(layout: MigLayout, project: Project, modelTitles: List<String>, comboBoxRef: Ref<JComboBox<String>>, onEnter: () -> Unit, onCancel: () -> Unit, onAccept: () -> Unit, onReject: () -> Unit): JPanel(layout) {
    private val subPanelA: JPanel = JPanel(MigLayout("insets 0, fillx")).apply {
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground

        val leftButton = CustomButton("Esc to cancel") { onCancel() }.apply {
            foreground = Color(128, 128, 128, 200)
            background = defaultBackground
        }

        val continueSettingsService = service<ContinueExtensionSettings>()

        val dropdown = JComboBox(modelTitles.toTypedArray()).apply {
            isEditable = true
            background = defaultBackground
            foreground = Color(128, 128, 128, 200)
            font = Font("Arial", Font.PLAIN, 11)
            border = EmptyBorder(2, 4, 2, 4)
            isOpaque = false
            isEditable = false
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            renderer = DefaultListCellRenderer().apply {
                horizontalAlignment = SwingConstants.RIGHT
            }
            selectedIndex = continueSettingsService.continueState.lastSelectedInlineEditModel?.let { modelTitles.indexOf(it) } ?: 0

            addActionListener {
                continueSettingsService.continueState.lastSelectedInlineEditModel = selectedItem as String
            }

//            setUI(TransparentArrowButtonUI())
        }

        comboBoxRef.set(dropdown)

        val rightButton = CustomButton("Submit") { onEnter() }.apply {
//            background = GetTheme().getHighlight()
            background = JBColor(0xe04573e8.toInt(), 0xe04573e8.toInt())
            foreground = JBColor(0xffffffff.toInt(), 0xffffffff.toInt())
        }

        val rightPanel = JPanel(MigLayout("insets 0, fillx")).apply {
            isOpaque = false
            border = EmptyBorder(0, 0, 0, 0)
            add(dropdown, "align right")
            add(rightButton, "align right")
        }

        border = EmptyBorder(4, 8, 4, 8)

        add(leftButton, "align left")
        add(rightPanel, "align right")
        isOpaque = false

        cursor = Cursor.getPredefinedCursor(Cursor.TEXT_CURSOR)
    }

    private val subPanelB: JPanel = JPanel(MigLayout("insets 0, fillx")).apply {
        // Get the global color scheme and default background color
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground

        val leftButton = CustomButton("Esc to cancel") { onCancel() }.apply {
            foreground = Color(128, 128, 128, 200)
            background = defaultBackground
        }

        val dropdown = JComboBox(modelTitles.toTypedArray()).apply {
            isEditable = true
            background = defaultBackground
            foreground = Color(128, 128, 128, 200)
            font = Font("Arial", Font.PLAIN, 11)
            border = EmptyBorder(2, 4, 2, 4)
            isOpaque = false
            isEditable = false
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            renderer = DefaultListCellRenderer().apply {
                horizontalAlignment = SwingConstants.RIGHT
            }

            isVisible = false

//            setUI(TransparentArrowButtonUI())
        }

        val progressBar = JProgressBar()
        progressBar.isIndeterminate = true

        val rightPanel = JPanel(MigLayout("insets 0, fillx")).apply {
            isOpaque = false
            border = EmptyBorder(0, 0, 0, 0)
            add(dropdown, "align right")
            add(progressBar, "align right")
        }



        border = EmptyBorder(4, 8, 4, 8)
        add(leftButton, "align left")
        add(rightPanel, "align right")
        isOpaque = false

        cursor = Cursor.getPredefinedCursor(Cursor.TEXT_CURSOR)
    }

    private val subPanelC: JPanel = JPanel(MigLayout("insets 0, fillx")).apply {
        val leftLabel = JLabel("Enter follow-up instructions").apply {
            foreground = Color(128, 128, 128, 200)
            font = Font("Arial", Font.PLAIN, 11)
        }

        val leftButton = CustomButton("${getAltKeyLabel()}⇧N") { onReject() }.apply {
            background = Color(255, 0, 0, 64)
        }

        val rightButton = CustomButton("${getAltKeyLabel()}⇧Y") { onAccept() }.apply {
            background = Color(0, 255, 0, 64)
        }

        val rightPanel = JPanel(MigLayout("insets 0, fillx")).apply {
            isOpaque = false
            add(leftButton, "align right")
            add(rightButton, "align right")
            border = EmptyBorder(0, 0, 0, 0)
        }

        add(leftLabel, "align left")
        add(rightPanel, "align right")
        border = EmptyBorder(4, 8, 4, 8)
        isOpaque = false
    }

    fun setup() {
        remove(subPanelB)
        remove(subPanelC)
        add(subPanelA, "grow, gap 0!")
    }

    fun enter() {
        remove(subPanelA)
        remove(subPanelC)
        add(subPanelB, "grow, gap 0!")
        revalidate()
        repaint()
    }

    fun finish() {
        remove(subPanelB)
        add(subPanelC, "grow, gap 0!")
        revalidate()
        repaint()
    }

    override fun paintComponent(g: Graphics) {
        val g2 = g as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        // Draw the rounded border
        val borderColor = Color(128, 128, 128, 128)
        val borderThickness = 1
        val borderRadius = 8

        g2.color = borderColor
        g2.stroke = BasicStroke(borderThickness.toFloat())
        g2.drawRoundRect(
                borderThickness / 2,
                borderThickness / 2,
                width - borderThickness - SHADOW_SIZE + 1,
                height - borderThickness - SHADOW_SIZE + 1,
                borderRadius,
                borderRadius
        )

        super.paintComponent(g)
    }
}


class CustomButton(text: String, onClick: () -> Unit) : JLabel(text, CENTER) {
    private var isHovered = false

    init {
        isOpaque = false
        cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        addMouseListener(object : MouseAdapter() {
            override fun mouseEntered(e: MouseEvent?) {
                isHovered = true
                repaint()
            }

            override fun mouseExited(e: MouseEvent?) {
                isHovered = false
                repaint()
            }

            override fun mouseClicked(e: MouseEvent?) {
                onClick()
            }
        })

//        verticalAlignment = CENTER
        font = Font("Arial", Font.PLAIN, 11)
        border = EmptyBorder(2, 4, 2, 4)
    }
    override fun paintComponent(g: Graphics) {
        val g2 = g as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val cornerRadius = 8
        val rect = Rectangle(0, 0, width, height)
        val roundRect = RoundRectangle2D.Float(rect.x.toFloat(), rect.y.toFloat(), rect.width.toFloat(), rect.height.toFloat(), cornerRadius.toFloat(), cornerRadius.toFloat())
        if (isHovered) {
            g2.color = background.brighter()
        } else {
            g2.color = background
        }
        g2.fill(roundRect)
        g2.color = foreground
        g2.drawString(text, (width / 2 - g.fontMetrics.stringWidth(text) / 2).toFloat(),
                (height / 2 + g.fontMetrics.ascent / 2).toFloat())
    }
}

class CustomTextArea(rows: Int, columns: Int) : JXTextArea("") {
    init {
        setRows(rows)
        setColumns(columns)
    }

    override fun paintComponent(g: Graphics) {
        // Draw placeholder
        if (text.isEmpty()) {
            g.color = Color(128, 128, 128, 255)
            g.font = Font("Arial", Font.PLAIN, MAIN_FONT_SIZE)
            g.drawString("Enter instructions to edit highlighted code", 8, 20)
        }

        super.paintComponent(g)
    }
}

class ShadowPanel(layout: LayoutManager) : JXPanel(layout) {
    override fun getPreferredSize(): Dimension {
        val prefSize = super.getPreferredSize()
        val insets = getInsets()
        prefSize.width += insets.left + insets.right
        prefSize.height += insets.top + insets.bottom
        return prefSize
    }

    override fun paintComponent(g: Graphics) {
        super.paintComponent(g)
    }
}

class TransparentArrowButtonUI : BasicComboBoxUI() {
    override fun createArrowButton() = object : JButton() {
        override fun paintComponent(g: Graphics) {
            val g2 = g as Graphics2D
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
            val size = 6
            val x = (width - size) / 2
            val y = (height - size / 2) / 2
            val triangle = Polygon(
                    intArrayOf(x, x + size, x + size / 2),
                    intArrayOf(y, y, (y + size / 1.16).toInt()),
                    3
            )
            g2.color = Color.GRAY
            g2.fill(triangle)
        }
    }.apply {
        border = EmptyBorder(0, 0, 0, 0)
//        background = Color(0, 0, 0, 0)
        isOpaque = false
    }

    override fun getInsets(): Insets {
        return JBUI.insets(0, 0, 0, 0)
    }

    override fun installUI(c: JComponent?) {
        super.installUI(c)
        comboBox.border = EmptyBorder(0, 0, 0, 0)
        comboBox.isOpaque = false
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground
        comboBox.background = defaultBackground
    }
}