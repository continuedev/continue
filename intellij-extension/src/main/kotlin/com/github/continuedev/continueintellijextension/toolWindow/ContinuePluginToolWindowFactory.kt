package com.github.continuedev.continueintellijextension.toolWindow

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.ui.components.JBPanel
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefJSQuery
import javax.swing.*
import com.github.continuedev.continueintellijextension.activities.getContinueServerUrl
import com.github.continuedev.continueintellijextension.`continue`.getMachineUniqueID
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.runJsInWebview
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.jcef.*
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import javax.swing.JComponent
import kotlin.math.max
import kotlin.math.min

const val JS_QUERY_POOL_SIZE = "200"

class ContinuePluginToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val continueToolWindow = ContinuePluginWindow(toolWindow, project)
        val content = ContentFactory.getInstance().createContent(continueToolWindow.content, null, false)
        toolWindow.contentManager.addContent(content)
    }

    override fun shouldBeAvailable(project: Project) = true


    class ContinuePluginWindow(toolWindow: ToolWindow, project: Project) {

        init {
            System.setProperty("ide.browser.jcef.jsQueryPoolSize", JS_QUERY_POOL_SIZE)
        }

        suspend fun waitForSessionId(pluginService: ContinuePluginService) {
            while (pluginService.sessionId == null) {
                delay(200)
            }
            return
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

            val continuePluginService = ServiceManager.getService(
                    project,
                    ContinuePluginService::class.java
            )
            continuePluginService.continuePluginWindow = this

            // Listen for events sent from browser
            val myJSQueryOpenInBrowser = JBCefJSQuery.create((browser as JBCefBrowserBase?)!!)
            myJSQueryOpenInBrowser.addHandler { msg: String? ->
                val parser = JsonParser()
                val json: JsonObject = parser.parse(msg).asJsonObject
                val type = json.get("type").asString
                when (type) {
                    "onLoad" -> {
                        GlobalScope.launch {
                            // Set the colors to match Intellij theme
                            val globalScheme = EditorColorsManager.getInstance().globalScheme
                            val defaultBackground = globalScheme.defaultBackground
                            val defaultForeground = globalScheme.defaultForeground
                            val defaultBackgroundHex = String.format("#%02x%02x%02x", defaultBackground.red, defaultBackground.green, defaultBackground.blue)
                            val defaultForegroundHex = String.format("#%02x%02x%02x", defaultForeground.red, defaultForeground.green, defaultForeground.blue)

                            val grayscale = (defaultBackground.red * 0.3 + defaultBackground.green * 0.59 + defaultBackground.blue * 0.11).toInt()

                            val adjustedRed: Int
                            val adjustedGreen: Int
                            val adjustedBlue: Int

                            val tint: Int = 20
                            if (grayscale > 128) { // if closer to white
                                adjustedRed = max(0, defaultBackground.red - tint)
                                adjustedGreen = max(0, defaultBackground.green - tint)
                                adjustedBlue = max(0, defaultBackground.blue - tint)
                            } else { // if closer to black
                                adjustedRed = min(255, defaultBackground.red + tint)
                                adjustedGreen = min(255, defaultBackground.green + tint)
                                adjustedBlue = min(255, defaultBackground.blue + tint)
                            }

                            val secondaryDarkHex = String.format("#%02x%02x%02x", adjustedRed, adjustedGreen, adjustedBlue)

                            browser.executeJavaScriptAsync("document.body.style.setProperty(\"--vscode-editor-foreground\", \"$defaultForegroundHex\");")
                            browser.executeJavaScriptAsync("document.body.style.setProperty(\"--vscode-editor-background\", \"$defaultBackgroundHex\");")
                            browser.executeJavaScriptAsync("document.body.style.setProperty(\"--vscode-list-hoverBackground\", \"$secondaryDarkHex\");")

                            // Wait for session ID, then pass the onLoad information
                            waitForSessionId(continuePluginService)

                            val sessionId = continuePluginService.sessionId
                            val workspacePaths = continuePluginService.worksapcePaths

                            val jsonData = mutableMapOf(
                                    "type" to "onLoad",
                                    "sessionId" to sessionId,
                                    "apiUrl" to getContinueServerUrl(),
                                    "workspacePaths" to workspacePaths,
                                    "vscMachineId" to getMachineUniqueID(),
                                    "vscMediaUrl" to "http://continue",
                                    "dataSwitchOn" to true
                            )
                            val jsonString = Gson().toJson(jsonData)
                            browser.executeJavaScriptAsync("""window.postMessage($jsonString, "*");""")
                        }

                    }
                }


                null
            }

            // Listen for the page load event
            browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
                override fun onLoadingStateChange(
                        browser: CefBrowser?,
                        isLoading: Boolean,
                        canGoBack: Boolean,
                        canGoForward: Boolean
                ) {
                    if (!isLoading) {
                        // The page has finished loading
                        executeJavaScript(browser, myJSQueryOpenInBrowser)
                    }
                }
            }, browser.cefBrowser)

            browser
        }

        fun executeJavaScript(browser: CefBrowser?, myJSQueryOpenInBrowser: JBCefJSQuery) {
            // Execute JavaScript - you might want to handle potential exceptions here
            val script = """window.postIntellijMessage = function(type, data) {
                const msg = JSON.stringify({type, data});
                ${myJSQueryOpenInBrowser.inject("msg")}
            }""".trimIndent()

            browser?.executeJavaScript(script, browser.url, 0)
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