package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.panel
import com.intellij.ui.jcef.JBCefApp
import com.intellij.util.ui.JBUI.Borders.empty
import javax.swing.JComponent
import javax.swing.JPanel

const val JS_QUERY_POOL_SIZE = "200"

class ContinuePluginToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val inner = if (JBCefApp.isSupported())
            ContinuePluginWindow(project).content
        else
            createNotSupportedPanel()
        val content = ContentFactory.getInstance().createContent(inner, null, false)
        toolWindow.contentManager.addContent(content)
        toolWindow.setTitleActions(
            listOf(
                ActionManager.getInstance().getAction("ContinueSidebarActionsGroup"),
                ActionManager.getInstance().getAction("MaximizeToolWindow")
            )
        )
    }

    override fun shouldBeAvailable(project: Project) = true

    private fun createNotSupportedPanel(): JPanel {
        val html = ContinuePluginToolWindowFactory::class.java.classLoader
            .getResourceAsStream("jcef_error.html")
            .bufferedReader()
            .readText()
        return panel {
            row {
                text(html)
            }
        }.withBorder(empty(10))
    }

    class ContinuePluginWindow(project: Project) {
        private val defaultGUIUrl = "http://continue/index.html"

        init {
            System.setProperty("ide.browser.jcef.jsQueryPoolSize", JS_QUERY_POOL_SIZE)
            System.setProperty("ide.browser.jcef.contextMenu.devTools.enabled", "true")
            System.setProperty("ide.browser.jcef.out-of-process.enabled", "false")
        }

        val browser: ContinueBrowser by lazy {
            val url = System.getenv("GUI_URL") ?: defaultGUIUrl

            val browser = ContinueBrowser(project, url)
            project.service<ContinuePluginService>().continuePluginWindow = this
            browser
        }

        val content: JComponent
            get() = browser.browser.component
    }
}
