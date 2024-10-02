package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.`continue`.GetTheme
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.getAltKeyLabel
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
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
import java.awt.*
import java.awt.event.*
import java.awt.geom.Path2D
import javax.swing.*
import javax.swing.border.EmptyBorder
import javax.swing.event.DocumentEvent
import javax.swing.event.DocumentListener
import javax.swing.plaf.basic.BasicComboBoxUI
import kotlin.math.max
import java.awt.geom.RoundRectangle2D
import java.awt.geom.AffineTransform
import javax.swing.event.ListDataListener

const val MAIN_FONT_SIZE = 13

fun makeTextArea(): JTextArea {
    val textArea = CustomTextArea(1, 40).apply {
        lineWrap = true
        wrapStyleWord = true
        isOpaque = false
        background = GetTheme().getSecondaryDark()
        maximumSize = Dimension(400, Short.MAX_VALUE.toInt())
        margin = JBUI.insets(6, 4, 6, 4)
        font = UIUtil.getFontWithFallback("Arial", Font.PLAIN, MAIN_FONT_SIZE)
        preferredSize = Dimension(400, 75)
    }
    textArea.putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)
    return textArea
}

fun makePanel(
    project: Project,
    customPanelRef: Ref<CustomPanel>,
    textArea: JTextArea,
    inlayRef: Ref<Disposable>,
    comboBoxRef: Ref<JComboBox<String>>,
    leftInset: Int,
    modelTitles: List<String>,
    onEnter: () -> Unit,
    onCancel: () -> Unit,
    onAccept: () -> Unit,
    onReject: () -> Unit
): JPanel {
    val topPanel = ShadowPanel(MigLayout("wrap 1, insets 2 ${leftInset} 2 2, gap 0!")).apply {
        background = JBColor(0x20888888.toInt(), 0x20888888.toInt())
        isOpaque = false
    }

    val panel = CustomPanel(
        MigLayout("wrap 1, insets 4 10 0 2, gap 0!, fillx"),
        project,
        modelTitles,
        comboBoxRef,
        onEnter,
        onCancel,
        onAccept,
        onReject,
        textArea
    ).apply {
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground
        background = defaultBackground
        add(textArea, "grow, gap 0!, height 100%")

        putClientProperty(UIUtil.HIDE_EDITOR_FROM_DATA_CONTEXT_PROPERTY, true)
        preferredSize = textArea.preferredSize
        setup()
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

fun openInlineEdit(project: Project?, editor: Editor) {
    if (project == null) return

    // Don't open in terminal
    if (EditorUtils().isTerminal(editor)) {
        return
    }

    val manager = EditorComponentInlaysManager.from(editor)

    // Get list of model titles
    val continuePluginService = project.service<ContinuePluginService>()
    val modelTitles = mutableListOf<String>()
    continuePluginService.coreMessenger?.request("config/getSerializedProfileInfo", null, null) { response ->
        val config = response as Map<String, Any>
        val models = (config["config"] as Map<String, Any>)["models"] as List<Map<String, Any>>
        modelTitles.addAll(models.map { it["title"] as String })
    }
    val maxWaitTime = 200
    val startTime = System.currentTimeMillis()
    while (modelTitles.isEmpty() && System.currentTimeMillis() - startTime < maxWaitTime) {
        Thread.sleep(20)
    }

    // Get highlighted range
    val selectionModel = editor.selectionModel
    val startLineNumber = editor.document.getLineNumber(selectionModel.selectionStart)
    val endLineNumber = editor.document.getLineNumber(selectionModel.selectionEnd)
    val start = editor.document.getLineStartOffset(startLineNumber)
    val end = editor.document.getLineEndOffset(endLineNumber)
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
    val charWidth =
        editor.contentComponent.getFontMetrics(editor.colorsScheme.getFont(EditorFontType.PLAIN)).charWidth(' ')
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

    val panel =
        makePanel(project, customPanelRef, textArea, inlayRef, comboBoxRef, leftInset, modelTitles, { onEnter() }, {
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

    // Listen for key typed events after diff streaming is finished
    textArea.addKeyListener(object : KeyAdapter() {
        override fun keyTyped(e: KeyEvent) {
            if (customPanelRef.get().isFinished) {
                customPanelRef.get().setup()
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

/**
 * Adapted from https://github.com/cursive-ide/component-inlay-example/blob/master/src/main/kotlin/inlays/InlineEditAction.kt
 */
class InlineEditAction : AnAction(), DumbAware {
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = true
        e.presentation.isVisible = true
    }

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.EDT
    }

    override fun actionPerformed(e: AnActionEvent) {
        val editor = e.getData(PlatformDataKeys.EDITOR) ?: return
        val project = e.getData(PlatformDataKeys.PROJECT) ?: return
        openInlineEdit(project, editor)
    }
}

class CustomPanel(
    layout: MigLayout,
    project: Project,
    modelTitles: List<String>,
    comboBoxRef: Ref<JComboBox<String>>,
    private val onEnter: () -> Unit,
    private val onCancel: () -> Unit,
    private val onAccept: () -> Unit,
    private val onReject: () -> Unit,
    private val textArea: JTextArea
) : JPanel(layout) {
    private val shadowSize = 5
    private val cornerRadius = 8
    private val shadowColor = Color(0, 0, 0, 40) // Lighter shadow
    private val borderColor = Color(128, 128, 128, 128)
    private val borderThickness = 1
    private val triangleSize = 6
    private val rightMargin = 3.0
    private val closeButton: JComponent = createCloseButton()
    private val originalTextColor: Color = textArea.foreground
    private val greyTextColor: Color = Color(128, 128, 128, 200)
    public var isFinished = false

    init {
        isOpaque = false
        add(closeButton, "pos 100%-25 0 -3 3, w 20!, h 20!")
    }

    private fun createCloseButton(): JComponent {
        return CustomButton("X") { onCancel() }.apply {
            foreground = Color(128, 128, 128, 128)
            background = Color(0, 0, 0, 0)
            font = UIUtil.getFontWithFallback("Arial", Font.BOLD, 10)
            border = EmptyBorder(2, 6, 2, 6)
            toolTipText = "`esc` to cancel"

            addMouseListener(object : MouseAdapter() {
                override fun mouseEntered(e: MouseEvent) {
                    foreground = Color(128, 128, 128, 255)
                }

                override fun mouseExited(e: MouseEvent) {
                    foreground = Color(128, 128, 128, 128)
                }
            })
        }
    }

    private val subPanelA: JPanel = JPanel(MigLayout("insets 0, fillx")).apply {
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground
        val continueSettingsService = service<ContinueExtensionSettings>()
        val dropdown = JComboBox(modelTitles.toTypedArray()).apply {
            setUI(TransparentArrowButtonUI())
            isEditable = true
            background = defaultBackground
            foreground = Color(128, 128, 128, 200)
            font = UIUtil.getFontWithFallback("Arial", Font.PLAIN, 11)
            border = EmptyBorder(2, 4, 2, 4)
            isOpaque = false
            isEditable = false
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            renderer = DefaultListCellRenderer().apply {
                horizontalAlignment = SwingConstants.LEFT
            }
            selectedIndex = continueSettingsService.continueState.lastSelectedInlineEditModel?.let {
                val index = modelTitles.indexOf(it)
                if (index != -1) index else 0
            } ?: 0

            addActionListener {
                continueSettingsService.continueState.lastSelectedInlineEditModel = selectedItem as String
            }
        }

        comboBoxRef.set(dropdown)

        val rightButton = CustomButton("⏎  Enter") { onEnter() }.apply {
            background = JBColor(0x33999998.toInt(), 0x33999998.toInt())
            foreground = Color.WHITE
            border = EmptyBorder(2, 6, 2, 6)
        }

        val rightPanel = JPanel(MigLayout("insets 0, fillx")).apply {
            isOpaque = false
            border = EmptyBorder(0, 0, 0, 0)
            add(dropdown, "align right")
            add(rightButton, "align right")
        }

        border = EmptyBorder(0, 0, 20, 16)

        add(dropdown, "align left")
        add(rightPanel, "align right, split 2")
        isOpaque = false

        cursor = Cursor.getPredefinedCursor(Cursor.TEXT_CURSOR)
    }

    private val subPanelB: JPanel = JPanel(BorderLayout()).apply {
        isOpaque = false

        val progressBar = JProgressBar().apply {
            isIndeterminate = true
        }

        add(progressBar, BorderLayout.CENTER)
        border = BorderFactory.createEmptyBorder(0, 0, 20, 16)
    }

    private val subPanelC: JPanel = JPanel(MigLayout("insets 0, fillx")).apply {
        val leftLabel = JLabel("Type to re-prompt").apply {
            foreground = Color(156, 163, 175) // text-gray-400
            font = UIUtil.getFontWithFallback("Arial", Font.PLAIN, 11)
            border = EmptyBorder(0, 4, 0, 0)
        }

        val leftButton = CustomButton("Reject (${getAltKeyLabel()}⇧N)") { onReject() }.apply {
            background = Color(239, 68, 68) // text-red-500
            foreground = Color.WHITE
        }

        val rightButton = CustomButton("Accept (${getAltKeyLabel()}⇧Y)") { onAccept() }.apply {
            background = Color(34, 197, 94)  // text-green-500
            foreground = Color.WHITE
        }

        val rightPanel = JPanel(MigLayout("insets 0, fillx")).apply {
            isOpaque = false
            add(leftButton, "align right")
            add(rightButton, "align right")
            border = EmptyBorder(0, 0, 0, 0)
        }

        add(leftLabel, "align left")
        add(rightPanel, "align right")
        border = BorderFactory.createEmptyBorder(0, 0, 20, 16)
        isOpaque = false
    }

    fun setup() {
        remove(subPanelB)
        remove(subPanelC)
        add(subPanelA, "grow, gap 0!")
        isFinished = false
        revalidate()
        repaint()
        textArea.foreground = originalTextColor
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
        isFinished = true
        textArea.foreground = greyTextColor
    }

    override fun paintComponent(g: Graphics) {
        super.paintComponent(g)

        val g2 = g as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val w = width - shadowSize
        val h = height - shadowSize

        // Create the shape for the tooltip/triangle
        val shape = Path2D.Double()
        shape.moveTo(borderThickness / 2.0, cornerRadius.toDouble())
        shape.quadTo(borderThickness / 2.0, borderThickness / 2.0, cornerRadius.toDouble(), borderThickness / 2.0)
        shape.lineTo(w - cornerRadius.toDouble() - rightMargin, borderThickness / 2.0)
        shape.quadTo(
            w - borderThickness / 2.0 - rightMargin,
            borderThickness / 2.0,
            w - borderThickness / 2.0 - rightMargin,
            cornerRadius.toDouble()
        )
        shape.lineTo(w - borderThickness / 2.0 - rightMargin, h - cornerRadius - triangleSize.toDouble())
        shape.quadTo(
            w - borderThickness / 2.0 - rightMargin,
            h - triangleSize.toDouble(),
            w - cornerRadius.toDouble() - rightMargin,
            h - triangleSize.toDouble()
        )
        shape.lineTo(triangleSize.toDouble(), h - triangleSize.toDouble())
        shape.lineTo(borderThickness / 2.0, h.toDouble())
        shape.lineTo(borderThickness / 2.0, cornerRadius.toDouble())

        // Draw shadow
        g2.color = shadowColor
        g2.fill(
            shape.createTransformedShape(
                AffineTransform.getTranslateInstance(
                    shadowSize.toDouble(),
                    shadowSize.toDouble()
                )
            )
        )

        // Draw main shape
        g2.color = background
        g2.fill(shape)

        // Draw border
        g2.color = borderColor
        g2.stroke = BasicStroke(borderThickness.toFloat())
        g2.draw(shape)
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
        font = UIUtil.getFontWithFallback("Arial", Font.PLAIN, 11)
        border = EmptyBorder(2, 4, 2, 4)
    }

    override fun paintComponent(g: Graphics) {
        val g2 = g as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val cornerRadius = 8
        val rect = Rectangle(0, 0, width, height)
        val roundRect = RoundRectangle2D.Float(
            rect.x.toFloat(),
            rect.y.toFloat(),
            rect.width.toFloat(),
            rect.height.toFloat(),
            cornerRadius.toFloat(),
            cornerRadius.toFloat()
        )
        if (isHovered) {
            g2.color = background.brighter()
        } else {
            g2.color = background
        }
        g2.fill(roundRect)
        g2.color = foreground
        g2.drawString(
            text, (width / 2 - g.fontMetrics.stringWidth(text) / 2).toFloat(),
            (height / 2 + g.fontMetrics.ascent / 2).toFloat()
        )
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
            g.font = UIUtil.getFontWithFallback("Arial", Font.PLAIN, MAIN_FONT_SIZE)
            g.drawString("Enter instructions...", 3, 20)
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
    override fun createArrowButton() = JButton().apply {
        isVisible = false
        preferredSize = Dimension(0, 0)
    }

    override fun getInsets(): Insets {
        return JBUI.insets(0, 6, 0, 0)
    }

    override fun installUI(c: JComponent?) {
        super.installUI(c)
        comboBox.isOpaque = false
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground
        comboBox.background = defaultBackground

        // Modify the ComboBoxModel to include the down symbol
        val originalModel = comboBox.model
        comboBox.model = object : ComboBoxModel<Any> {
            override fun getSize(): Int = originalModel.size
            override fun getElementAt(index: Int): Any? = originalModel.getElementAt(index)
            override fun setSelectedItem(anItem: Any?) {
                originalModel.selectedItem = anItem
            }

            override fun getSelectedItem(): Any? {
                val item = originalModel.selectedItem
                return if (item is String) "$item ▾" else item
            }

            override fun addListDataListener(l: ListDataListener?) {
                originalModel.addListDataListener(l)
            }

            override fun removeListDataListener(l: ListDataListener?) {
                originalModel.removeListDataListener(l)
            }
        }
    }


    override fun paintCurrentValueBackground(g: Graphics, bounds: Rectangle, hasFocus: Boolean) {
        // Do nothing to prevent painting the background
    }


    override fun paintCurrentValue(g: Graphics, bounds: Rectangle, hasFocus: Boolean) {
        val renderer = comboBox.renderer
        val item = comboBox.selectedItem

        if (item != null) {
            val c = renderer.getListCellRendererComponent(listBox, item, -1, false, false)
            c.font = comboBox.font
            c.foreground = Color(156, 163, 175) // text-gray-400
            c.background = comboBox.background

            if (c is JComponent) {
                c.isOpaque = false
            }

            val currentValuePane = currentValuePane
            currentValuePane.paintComponent(g, c, comboBox, bounds.x, bounds.y, bounds.width, bounds.height, true)
        }
    }
}

