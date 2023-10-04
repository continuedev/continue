package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefClient
import org.cef.CefApp
import javax.swing.JComponent

const val JS_QUERY_POOL_SIZE = "200"

class ContinuePluginToolWindowFactory : ToolWindowFactory {

    init {
        thisLogger().warn("Don't forget to remove all non-needed sample code files with their corresponding registration entries in `plugin.xml`.")
    }

    override fun createToolWindowContent(
        project: Project,
        toolWindow: ToolWindow
    ) {
        val continuePluginService = ServiceManager.getService(
            project,
            ContinuePluginService::class.java
        )
        toolWindow.title = "Continue"

        toolWindow.component.parent?.add(continuePluginService.continuePluginWindow.content)
    }

    override fun shouldBeAvailable(project: Project) = true

    class ContinuePluginWindow(project: Project) {

        init {
            System.setProperty("ide.browser.jcef.jsQueryPoolSize", JS_QUERY_POOL_SIZE)
        }

        val webView: JBCefBrowser by lazy {
            val browser = JBCefBrowser()
            browser.jbCefClient.setProperty(
                JBCefClient.Properties.JS_QUERY_POOL_SIZE,
                JS_QUERY_POOL_SIZE
            )
            registerAppSchemeHandler()

            browser.loadURL("http://continue/index.html")
            Disposer.register(project, browser)
            browser
        }

        val content: JComponent
            get() = webView.component

        private fun registerAppSchemeHandler() {
            CefApp.getInstance().registerSchemeHandlerFactory(
                "http",
                "continue",
                CustomSchemeHandlerFactory()
            )
        }
    }
}
