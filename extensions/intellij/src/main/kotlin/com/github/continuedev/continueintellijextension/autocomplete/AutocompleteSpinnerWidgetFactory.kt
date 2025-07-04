package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.Icons
import com.github.continuedev.continueintellijextension.activities.ContinuePluginDisposable
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.WindowManager
import com.intellij.openapi.wm.impl.status.EditorBasedWidget
import com.intellij.ui.AnimatedIcon
import com.intellij.util.Consumer
import java.awt.event.MouseEvent
import javax.swing.Icon
import javax.swing.JLabel

class AutocompleteSpinnerWidget(project: Project) : EditorBasedWidget(project), StatusBarWidget.IconPresentation,
    Disposable {
    private val iconLabel = JLabel()
    private var isLoading = false
    
    private val animatedIcon = AnimatedIcon.Default()

    init {
        Disposer.register(project.service<ContinuePluginDisposable>(), this)
        updateIcon()
    }

    fun show() {
        println("Showing autocomplete spinner widget")
    }

    override fun dispose() {}

    override fun ID(): String {
        return ID
    }

    override fun getTooltipText(): String {
        val enabled = service<ContinueExtensionSettings>().state.enableTabAutocomplete
        return if (enabled) "Continue autocomplete enabled" else "Continue autocomplete disabled"
    }

    override fun getClickConsumer(): Consumer<MouseEvent>? {
        return null
    }

    override fun getIcon(): Icon = if (isLoading) animatedIcon else
        Icons.Continue

    fun setLoading(loading: Boolean) {
        isLoading = loading
        updateIcon()
    }

    private fun updateIcon() {
        iconLabel.icon = getIcon()


        // Update the widget
        val statusBar = WindowManager.getInstance().getStatusBar(project)
        statusBar?.updateWidget(ID())
    }

    override fun install(statusBar: StatusBar) {
        updateIcon()
    }

    override fun getPresentation(): StatusBarWidget.WidgetPresentation {
        return this
    }

    companion object {
        const val ID = "AutocompleteSpinnerWidget"
    }
}

class AutocompleteSpinnerWidgetFactory : StatusBarWidgetFactory {
    fun create(project: Project): AutocompleteSpinnerWidget {
        return AutocompleteSpinnerWidget(project)
    }

    override fun getId(): String {
        return AutocompleteSpinnerWidget.ID
    }

    override fun getDisplayName(): String {
        return "Continue Autocomplete"
    }

    override fun isAvailable(p0: Project): Boolean {
        return true
    }

    override fun createWidget(project: Project): StatusBarWidget {
        return create(project)
    }

    override fun disposeWidget(p0: StatusBarWidget) {
        Disposer.dispose(p0)
    }

    override fun canBeEnabledOn(p0: StatusBar): Boolean = true
}