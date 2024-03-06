package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.activities.showTutorial
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
                    "abort",
                    "getContinueDir",
                    "history/list",
                    "history/save",
                    "history/delete",
                    "history/load",
                    "devdata/log",
                    "config/addModel",
                    "config/deleteModel",
                    "config/addOpenAIKey",
                    "llm/streamComplete",
                    "llm/streamChat",
                    "llm/complete",
                    "command/run",
                    "context/loadSubmenuItems",
                    "context/getContextItems",
                    "context/addDocs",
                    "config/getBrowserSerialized",
        )

        init {
            System.setProperty("ide.browser.jcef.jsQueryPoolSize", JS_QUERY_POOL_SIZE)
            System.setProperty("ide.browser.jcef.osr.enabled", "false")
        }

        val webView: JBCefBrowser by lazy {
            val browser = JBCefBrowser.createBuilder().setOffScreenRendering(false).build()
            browser.jbCefClient.setProperty(
                    JBCefClient.Properties.JS_QUERY_POOL_SIZE,
                    JS_QUERY_POOL_SIZE
            )
            registerAppSchemeHandler()

            browser.loadURL("http://continue/index.html")
//            browser.loadHTML("<html><body><input type='text'/></body></html>")
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
                    continuePluginService.coreMessenger?.request(messageType, data, messageId, respond)
                    return@addHandler null
                }

                when (messageType) {
                    "onLoad" -> {
                        GlobalScope.launch {
                            // Set the colors to match Intellij theme
                            val colors = GetTheme().getTheme();
                            continuePluginService.sendToWebview("setColors", colors)

                            val jsonData = mutableMapOf(
                                    "windowId" to continuePluginService.windowId,
                                    "workspacePaths" to continuePluginService.workspacePaths,
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
                    "showTutorial" -> {
                        showTutorial(project)
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