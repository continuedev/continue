package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.`continue`.readConfigJson
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.panels.VerticalBox
import com.intellij.ui.content.ContentFactory
import org.apache.commons.lang3.RandomStringUtils
import java.awt.BorderLayout
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JPanel

const val JS_QUERY_POOL_SIZE = "200"

class ContinuePluginToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val readConfigJson = readConfigJson()
        val serverHost: String = readConfigJson.getOrDefault("serverHost", "127.0.0.1") as String
        val serverPort: String = readConfigJson.getOrDefault("serverPort", "8080") as String
        val serverToken = readConfigJson.getOrDefault("serverToken", RandomStringUtils.randomAlphabetic(16)) as String
        val externalHostPort = readConfigJson.getOrDefault("serverExternalHostPort", "$serverHost:$serverPort") as String
        val splitMode = readConfigJson.getOrDefault("splitMode", false) as Boolean
        val osName = System.getProperty("os.name").toLowerCase()
        val os = when {
            osName.contains("mac") || osName.contains("darwin") -> "darwin"
            osName.contains("win") -> "win32"
            osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> "linux"
            else -> "linux"
        }
        val useOsr = readConfigJson.getOrDefault("useOsr", os == "linux") as Boolean
        val continueToolWindow = ContinuePluginWindow(toolWindow, project, splitMode, useOsr, serverHost, serverPort, serverToken, externalHostPort)
        val content = ContentFactory.getInstance().createContent(continueToolWindow.content, null, false)
        toolWindow.contentManager.addContent(content)
        val titleActions = mutableListOf<AnAction>()
        createTitleActions(titleActions)

        // Add MaximizeToolWindow action
        val action = ActionManager.getInstance().getAction("MaximizeToolWindow")
        if (action != null) {
            titleActions.add(action)
        }

        toolWindow.setTitleActions(titleActions)
    }

    private fun createTitleActions(titleActions: MutableList<in AnAction>) {
        val action = ActionManager.getInstance().getAction("ContinueSidebarActionsGroup")
        if (action != null) {
            titleActions.add(action)
        }
    }

    override fun shouldBeAvailable(project: Project) = true


    class ContinuePluginWindow(toolWindow: ToolWindow, project: Project, splitMode: Boolean, useOsr: Boolean,
                               serverHost: String, serverPort: String, serverToken: String, externalHostPort: String) {
        val host: String
        var url: String
        val urlPanel: JPanel = JPanel(BorderLayout())

        init {
            System.setProperty("ide.browser.jcef.jsQueryPoolSize", JS_QUERY_POOL_SIZE)
            System.setProperty("ide.browser.jcef.contextMenu.devTools.enabled", "true")
            this.host = if (splitMode) externalHostPort else "continue"
            url = "http://$host/index.html"
            if (splitMode) {
                url += "?splitMode=true&currentProject=${project.name}&serverToken=${serverToken}"
                val debugMode = false
                if (debugMode) {
                    url += "&debugWsHost=${host}"
                }
                val vbox = VerticalBox()

                val urlText = JBTextArea(url)
                urlText.lineWrap = true
                vbox.add(urlText)

                val openBtn = JButton("Open")
                openBtn.addActionListener {
                    BrowserUtil.browse(url)
                }
                vbox.add(openBtn)

                urlPanel.add(vbox)
                //init embedded server params
                ContinueBrowser.serverHost = serverHost
                ContinueBrowser.serverPort = serverPort
                ContinueBrowser.serverToken = serverToken
            }
        }

        val browser: ContinueBrowser by lazy {
            println("ContinuePluginWindow splitMode $splitMode")
            // Use to get hot-reloading in local development
            // val url = "http://localhost:5173/jetbrains_index.html";

            val browser = ContinueBrowser(project, url, useOsr = useOsr, splitMode = splitMode, staticResHost = host)
            val continuePluginService = ServiceManager.getService(
                    project,
                    ContinuePluginService::class.java
            )
            continuePluginService.continuePluginWindow = this
            browser
        }
        val content: JComponent
            get() = browser.browser?.component ?: urlPanel
    }


}