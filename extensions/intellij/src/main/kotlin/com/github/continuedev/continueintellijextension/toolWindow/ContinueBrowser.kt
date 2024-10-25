package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.activities.showTutorial
import com.github.continuedev.continueintellijextension.constants.MessageTypes
import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import kotlinx.coroutines.*
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import com.intellij.openapi.application.ApplicationInfo

class ContinueBrowser(val project: Project, url: String) {
    private val coroutineScope = CoroutineScope(
        SupervisorJob() + Dispatchers.Default
    )

    private val heightChangeListeners = mutableListOf<(Int) -> Unit>()

    private val PASS_THROUGH_TO_CORE = listOf(
        "update/modelChange",
        "ping",
        "abort",
        "history/list",
        "history/delete",
        "history/load",
        "history/save",
        "devdata/log",
        "config/addOpenAiKey",
        "config/addModel",
        "config/ideSettingsUpdate",
        "config/getSerializedProfileInfo",
        "config/deleteModel",
        "config/newPromptFile",
        "config/reload",
        "context/getContextItems",
        "context/loadSubmenuItems",
        "context/addDocs",
        "autocomplete/complete",
        "autocomplete/cancel",
        "autocomplete/accept",
        "command/run",
        "llm/complete",
        "llm/streamComplete",
        "llm/streamChat",
        "llm/listModels",
        "streamDiffLines",
        "stats/getTokensPerDay",
        "stats/getTokensPerModel",
        "index/setPaused",
        "index/forceReIndex",
        "index/indexingProgressBarInitialized",
        "completeOnboarding",
        "addAutocompleteModel",
        "config/listProfiles",
        "profiles/switch",
        "didChangeSelectedProfile",
    )

    private fun registerAppSchemeHandler() {
        CefApp.getInstance().registerSchemeHandlerFactory(
            "http",
            "continue",
            CustomSchemeHandlerFactory()
        )
    }

    val browser: JBCefBrowser

    init {
        this.browser = JBCefBrowser.createBuilder().setOffScreenRendering(shouldRenderOffScreen()).build()


        browser.jbCefClient.setProperty(
            JBCefClient.Properties.JS_QUERY_POOL_SIZE,
            JS_QUERY_POOL_SIZE
        )

        registerAppSchemeHandler()
        browser.loadURL(url);
        Disposer.register(project, browser)

        // Listen for events sent from browser
        val myJSQueryOpenInBrowser = JBCefJSQuery.create((browser as JBCefBrowserBase?)!!)
        myJSQueryOpenInBrowser.addHandler { msg: String? ->
            val parser = JsonParser()
            val json: JsonObject = parser.parse(msg).asJsonObject
            val messageType = json.get("messageType").asString
            val data = json.get("data")
            val messageId = json.get("messageId")?.asString

            val continuePluginService = ServiceManager.getService(
                project,
                ContinuePluginService::class.java
            )

            val ide = continuePluginService.ideProtocolClient;

            val respond = fun(data: Any?) {
                // This matches the way that we expect receive messages in IdeMessenger.ts (gui)
                // and the way they are sent in VS Code (webviewProtocol.ts)
                var result: Map<String, Any?>? = null
                if (MessageTypes.generatorTypes.contains(messageType)) {
                    result = data as? Map<String, Any?>
                } else {
                    result = mutableMapOf(
                        "status" to "success",
                        "done" to false,
                        "content" to data
                    )
                }

                sendToWebview(messageType, result, messageId ?: uuid())
            }

            if (PASS_THROUGH_TO_CORE.contains(messageType)) {
                continuePluginService.coreMessenger?.request(messageType, data, messageId, respond)
                return@addHandler null
            }

            when (messageType) {
                "jetbrains/editorInsetHeight" -> {
                    val height = data.asJsonObject.get("height").asInt
                    heightChangeListeners.forEach { it(height) }
                }

                "onLoad" -> {
                    coroutineScope.launch {
                        // Set the colors to match Intellij theme
                        val colors = GetTheme().getTheme();
                        sendToWebview("setColors", colors)

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
                    ide?.setFileOpen(data.get("filepath").asString)
                    ide?.highlightCode(
                        RangeInFile(
                            data.get("filepath").asString,
                            Range(
                                Position(
                                    data.get("start").asInt,
                                    0
                                ), Position(
                                    data.get("end").asInt,
                                    0
                                )
                            ),

                            ), "#00ff0022"
                    )
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
                    ide?.readRangeInFile(
                        RangeInFile(
                            data.get("filepath").asString,
                            Range(
                                Position(
                                    data.get("start").asInt,
                                    0
                                ), Position(
                                    data.get("end").asInt + 1,
                                    0
                                )
                            ),
                        )
                    )
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

    }

    fun executeJavaScript(browser: CefBrowser?, myJSQueryOpenInBrowser: JBCefJSQuery) {
        // Execute JavaScript - you might want to handle potential exceptions here
        val script = """window.postIntellijMessage = function(messageType, data, messageId) {
                const msg = JSON.stringify({messageType, data, messageId});
                ${myJSQueryOpenInBrowser.inject("msg")}
            }""".trimIndent()

        browser?.executeJavaScript(script, browser.url, 0)
    }

    fun sendToWebview(
        messageType: String,
        data: Any?,
        messageId: String = uuid()
    ) {
        val jsonData = Gson().toJson(
            mapOf(
                "messageId" to messageId,
                "messageType" to messageType,
                "data" to data
            )
        )
        val jsCode = buildJavaScript(jsonData)

        try {
            this.browser.executeJavaScriptAsync(jsCode)
        } catch (error: IllegalStateException) {
            println("Webview not initialized yet $error")
        }
    }

    private fun buildJavaScript(jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }

    /**
     * This function checks if the pluginSinceBuild is greater than or equal to 233, which corresponds
     * to IntelliJ platform version 2023.3 and later.
     *
     * Setting `setOffScreenRendering` to `false` causes a number of issues such as a white screen flash when loading
     * the GUI and the inability to set `cursor: pointer`. However, setting `setOffScreenRendering` to `true` on
     * platform versions prior to 2023.3.4 causes larger issues such as an inability to type input for certain langauges,
     * e.g. Korean.
     *
     * References:
     * 1. https://youtrack.jetbrains.com/issue/IDEA-347828/JCEF-white-flash-when-tool-window-show#focus=Comments-27-9334070.0-0
     *    This issue mentions that white screen flash problems were resolved in platformVersion 2023.3.4.
     * 2. https://www.jetbrains.com/idea/download/other.html
     *    This documentation shows mappings from platformVersion to branchNumber.
     *
     * We use the branchNumber (e.g., 233) instead of the full version number (e.g., 2023.3.4) because
     * it's a simple integer without dot notation, making it easier to compare.
     */
    private fun shouldRenderOffScreen(): Boolean {
        val minBuildNumber = 233
        val applicationInfo = ApplicationInfo.getInstance()
        val currentBuildNumber = applicationInfo.build.baselineVersion
        return currentBuildNumber >= minBuildNumber
    }
}
