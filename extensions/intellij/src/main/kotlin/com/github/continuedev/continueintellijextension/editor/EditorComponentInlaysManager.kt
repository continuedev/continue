package com.github.continuedev.continueintellijextension.editor

import com.intellij.openapi.Disposable
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.ex.util.EditorUtil
import com.intellij.openapi.editor.impl.EditorEmbeddedComponentManager
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.editor.impl.view.FontLayoutService
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.Key
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.concurrency.annotations.RequiresEdt
import com.intellij.util.ui.JBUI
import java.awt.Dimension
import java.awt.Font
import java.awt.event.ComponentAdapter
import java.awt.event.ComponentEvent
import javax.swing.JComponent
import javax.swing.ScrollPaneConstants
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * Copied from com.intellij.util.ui.codereview.diff.EditorComponentInlaysManager
 * via https://github.com/cursive-ide/component-inlay-example/blob/master/src/main/kotlin/inlays/EditorComponentInlaysManager.kt
 */
class EditorComponentInlaysManager(val editor: EditorImpl, private val onlyOneInlay: Boolean) : Disposable {

    private val managedInlays = mutableMapOf<ComponentWrapper, Disposable>()
    private val editorWidthWatcher = EditorTextWidthWatcher()

    init {
        editor.scrollPane.viewport.addComponentListener(editorWidthWatcher)
        Disposer.register(this, Disposable {
            editor.scrollPane.viewport.removeComponentListener(editorWidthWatcher)
        })

        EditorUtil.disposeWithEditor(editor, this)
    }


    @RequiresEdt
    fun insert(lineIndex: Int, component: JComponent, showAbove: Boolean = false): Disposable? {
        try {
            // Check if editor is disposed
            if (editor.isDisposed) return null
        } catch (e: Exception) {
            return null
        }

        if (onlyOneInlay) {
            // Dispose all other inlays
            managedInlays.values.forEach(Disposer::dispose)
        }

        val wrappedComponent = ComponentWrapper(component)
        val offset = editor.document.getLineStartOffset(lineIndex)

        return EditorEmbeddedComponentManager.getInstance()
            .addComponent(
                editor, wrappedComponent,
                EditorEmbeddedComponentManager.Properties(
                    EditorEmbeddedComponentManager.ResizePolicy.none(),
                    null,
                    !editor.inlayModel.getBlockElementsInRange(offset,offset).isEmpty(),
                    showAbove,
                    0,
                    offset
                )
            )?.also {
                managedInlays[wrappedComponent] = it
                Disposer.register(it, Disposable { managedInlays.remove(wrappedComponent) })
            }
    }

    private inner class ComponentWrapper(private val component: JComponent) : JBScrollPane(component) {
        init {
            isOpaque = false
            viewport.isOpaque = false

            border = JBUI.Borders.empty()
            viewportBorder = JBUI.Borders.empty()

            horizontalScrollBarPolicy = ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER
            verticalScrollBar.preferredSize = Dimension(0, 0)
            setViewportView(component)

            component.addComponentListener(object : ComponentAdapter() {
                override fun componentResized(e: ComponentEvent) =
                    dispatchEvent(ComponentEvent(component, ComponentEvent.COMPONENT_RESIZED))
            })
        }

        override fun getPreferredSize(): Dimension {
            return Dimension(editor.contentComponent.width, component.preferredSize.height)
        }
    }

    override fun dispose() {
        managedInlays.values.forEach(Disposer::dispose)
    }

    private inner class EditorTextWidthWatcher : ComponentAdapter() {

        var editorTextWidth: Int = 0

        private val maximumEditorTextWidth: Int
        private val verticalScrollbarFlipped: Boolean

        init {
            val metrics = editor.getFontMetrics(Font.PLAIN)
            val spaceWidth = FontLayoutService.getInstance().charWidth2D(metrics, ' '.code)
            // -4 to create some space
            maximumEditorTextWidth = ceil(spaceWidth * (editor.settings.getRightMargin(editor.project)) - 4).toInt()

            val scrollbarFlip = editor.scrollPane.getClientProperty(JBScrollPane.Flip::class.java)
            verticalScrollbarFlipped =
                scrollbarFlip == JBScrollPane.Flip.HORIZONTAL || scrollbarFlip == JBScrollPane.Flip.BOTH
        }

        override fun componentResized(e: ComponentEvent) = updateWidthForAllInlays()
        override fun componentHidden(e: ComponentEvent) = updateWidthForAllInlays()
        override fun componentShown(e: ComponentEvent) = updateWidthForAllInlays()

        private fun updateWidthForAllInlays() {
            val newWidth = calcWidth()
            if (editorTextWidth == newWidth) return
            editorTextWidth = newWidth

            managedInlays.keys.forEach {
                it.dispatchEvent(ComponentEvent(it, ComponentEvent.COMPONENT_RESIZED))
                it.invalidate()
            }
        }

        private fun calcWidth(): Int {
            val visibleEditorTextWidth =
                editor.scrollPane.viewport.width - getVerticalScrollbarWidth() - getGutterTextGap()
            return min(max(visibleEditorTextWidth, 0), maximumEditorTextWidth)
        }

        private fun getVerticalScrollbarWidth(): Int {
            val width = editor.scrollPane.verticalScrollBar.width
            return if (!verticalScrollbarFlipped) width * 2 else width
        }

        private fun getGutterTextGap(): Int {
            return if (verticalScrollbarFlipped) {
                val gutter = (editor as EditorEx).gutterComponentEx
                gutter.width - gutter.whitespaceSeparatorOffset
            } else 0
        }
    }

    companion object {
        val INLAYS_KEY: Key<EditorComponentInlaysManager> = Key.create("EditorComponentInlaysManager")

        fun from(editor: Editor, onlyOneInlay: Boolean): EditorComponentInlaysManager {
            return synchronized(editor) {
                val manager = editor.getUserData(INLAYS_KEY)
                if (manager == null) {
                    val newManager = EditorComponentInlaysManager(editor as EditorImpl, false)
                    editor.putUserData(INLAYS_KEY, newManager)
                    newManager
                } else manager
            }
        }
    }
}