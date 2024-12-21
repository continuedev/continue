package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.activities.ContinuePluginDisposable
import com.github.continuedev.continueintellijextension.constants.MessageTypes
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.uuid
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter

class ContinueBrowser(val project: Project, url: String) {
    private val PASS_THROUGH_TO_CORE = listOf(
        "abort",
        "history/list",
        "history/delete",
        "history/load",
        "history/save",
        "devdata/log",
        "config/addModel",
        "config/newPromptFile",
        "config/ideSettingsUpdate",
        "config/getSerializedProfileInfo",
        "config/deleteModel",
        "config/listProfiles",
        "config/openProfile",
        "context/getContextItems",
        "context/getSymbolsForFiles",
        "context/loadSubmenuItems",
        "context/addDocs",
        "context/removeDocs",
        "context/indexDocs",
        "autocomplete/complete",
        "autocomplete/cancel",
        "autocomplete/accept",
        "command/run",
        "tts/kill",
        "llm/complete",
        "llm/streamComplete",
        "llm/streamChat",
        "llm/listModels",
        "streamDiffLines",
        "chatDescriber/describe",
        "stats/getTokensPerDay",
        "stats/getTokensPerModel",
        // Codebase
        "index/setPaused",
        "index/forceReIndex",
        "index/indexingProgressBarInitialized",
        // Docs, etc.
        "indexing/reindex",
        "indexing/abort",
        "indexing/setPaused",
        "docs/getSuggestedDocs",
        "docs/initStatuses",
        //
        "completeOnboarding",
        "addAutocompleteModel",
        "profiles/switch",
        "didChangeSelectedProfile",
        "tools/call",
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
        val isOSREnabled = ServiceManager.getService(ContinueExtensionSettings::class.java).continueState.enableOSR
        this.browser = JBCefBrowser.createBuilder().setOffScreenRendering(isOSREnabled).build()


        browser.jbCefClient.setProperty(
            JBCefClient.Properties.JS_QUERY_POOL_SIZE,
            JS_QUERY_POOL_SIZE
        )

        registerAppSchemeHandler()
        browser.loadURL(url);
        Disposer.register(ContinuePluginDisposable.getInstance(project), browser)

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


            val respond = fun(data: Any?) {
                // This matches the way that we expect receive messages in IdeMessenger.ts (gui)
                // and the way they are sent in VS Code (webviewProtocol.ts)
                var result: Map<String, Any?>? = if (MessageTypes.generatorTypes.contains(messageType)) {
                    data as? Map<String, Any?>
                } else {
                    mutableMapOf(
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

            if (msg != null) {
                continuePluginService.ideProtocolClient?.handleMessage(msg, respond)
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
            this.browser.executeJavaScriptAsync(jsCode).onError {
                println("Failed to execute jsCode error: ${it.message}")
            }
        } catch (error: IllegalStateException) {
            println("Webview not initialized yet $error")
        }
    }

    private fun buildJavaScript(jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }

}
