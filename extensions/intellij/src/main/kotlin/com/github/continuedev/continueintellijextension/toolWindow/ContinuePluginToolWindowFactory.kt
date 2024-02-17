package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.*
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import javax.swing.*
import kotlin.math.max
import kotlin.math.min


const val JS_QUERY_POOL_SIZE = "200"

class ContinuePluginToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val continueToolWindow = ContinuePluginWindow(toolWindow, project)
        val content = ContentFactory.getInstance().createContent(continueToolWindow.content, null, false)
        toolWindow.contentManager.addContent(content)
        val titleActions = mutableListOf<AnAction>()
        createTitleActions(titleActions)
        toolWindow.setTitleActions(titleActions)
    }

    private fun createTitleActions(titleActions: MutableList<in AnAction>) {
        val action = ActionManager.getInstance().getAction("ContinueSidebarActionsGroup")
        if (action != null) {
            titleActions.add(action)
        }
    }

    override fun shouldBeAvailable(project: Project) = true


    class ContinuePluginWindow(toolWindow: ToolWindow, project: Project) {

        val PASS_THROUGH_TO_CORE = listOf(
                "getSerializedConfig"
        )

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
//            browser.loadURL("http://localhost:5173/index.html")
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
                val messageType = json.get("messageType").asString
                val data = json.get("data")
                val messageId = json.get("messageId")?.asString

                val ide = continuePluginService.ideProtocolClient;

                val respond = fun(data: Any?) {
                    val jsonData = mutableMapOf(
                        "messageId" to messageId,
                        "data" to data,
                        "messageType" to messageType
                    )
                    val jsonString = Gson().toJson(jsonData)
                    continuePluginService.sendToWebview(messageType, data, messageId ?: uuid())
                }

                if (PASS_THROUGH_TO_CORE.contains(messageType)) {
                    continuePluginService.coreMessenger?.request(messageType, data, respond)
                    return@addHandler null
                }

                when (messageType) {
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
                            browser.executeJavaScriptAsync("document.body.style.setProperty(\"--vscode-sideBar-background\", \"$defaultBackgroundHex\");")
                            browser.executeJavaScriptAsync("document.body.style.setProperty(\"--vscode-input-background\", \"$secondaryDarkHex\");")
                            browser.executeJavaScriptAsync("document.body.style.setProperty(\"--vscode-editor-background\", \"$defaultBackgroundHex\");")

                            val jsonData = mutableMapOf(
                                    "windowId" to continuePluginService.windowId,
                                    "workspacePaths" to continuePluginService.worksapcePaths,
                                    "vscMachineId" to getMachineUniqueID(),
                                    "vscMediaUrl" to "http://continue",
                            )
                            respond(jsonData)
                        }

                    }
                    "showLines" -> {
                        val data = data.asJsonObject
                        ide?.highlightCode(RangeInFile(
                                data.get("filepath").asString,
                                Range(Position(
                                        data.get("start").asInt,
                                        0
                                ), Position(
                                        data.get("end").asInt,
                                        0
                                )),

                        ),"#00ff0022")
                    }
                    "showVirtualFile" -> {
                        val data = data.asJsonObject
                        ide?.showVirtualFile(data.get("name").asString, data.get("content").asString)
                    }
                    "showFile" -> {
                        val data = data.asJsonObject
                        ide?.setFileOpen(data.get("filepath").asString)
                    }
                    "reloadWindow" -> {}
                    "openConfigJson" -> {
                        ide?.setFileOpen(getConfigJsonPath())
                    }
                    "readRangeInFile" -> {
                        val data = data.asJsonObject
                        ide?.readRangeInFile(RangeInFile(
                                data.get("filepath").asString,
                                Range(Position(
                                        data.get("start").asInt,
                                        0
                                ), Position(
                                        data.get("end").asInt + 1,
                                        0
                                )),
                        ))
                    }
                    "focusEditor" -> {}

                    // IDE //
                    else -> {
                        if (msg != null) {
                            ide?.handleMessage(msg, respond)
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
            val script = """window.postIntellijMessage = function(messageType, data, messageId) {
                const msg = JSON.stringify({messageType, data, messageId});
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