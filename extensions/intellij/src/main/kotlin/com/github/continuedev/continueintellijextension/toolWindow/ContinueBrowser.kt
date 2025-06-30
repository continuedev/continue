package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.activities.ContinuePluginDisposable
import com.github.continuedev.continueintellijextension.constants.MessageTypes.Companion.PASS_THROUGH_TO_CORE
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.uuid
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import com.intellij.ui.jcef.JBCefClient.Properties
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter

class ContinueBrowser(val project: Project, url: String) {

    val browser: JBCefBrowser

    init {
        val isOSREnabled = service<ContinueExtensionSettings>().continueState.enableOSR

        this.browser = JBCefBrowser.createBuilder().setOffScreenRendering(isOSREnabled).build().apply {
            // To avoid using System.setProperty to affect other plugins,
            // we should configure JS_QUERY_POOL_SIZE after JBCefClient is instantiated,
            // and eliminate the 'Uncaught TypeError: window.cefQuery_xxx is not a function' error
            // in the JS debug console, which is caused by ContinueBrowser lazy loading.
            jbCefClient.setProperty(Properties.JS_QUERY_POOL_SIZE, JS_QUERY_POOL_SIZE)
        }

        registerAppSchemeHandler()
        Disposer.register(project.service<ContinuePluginDisposable>(), browser)

        // Listen for events sent from browser
        val myJSQueryOpenInBrowser = JBCefJSQuery.create((browser as JBCefBrowserBase?)!!)

        myJSQueryOpenInBrowser.addHandler { msg: String? ->
            val parser = JsonParser()
            val json: JsonObject = parser.parse(msg).asJsonObject
            val messageType = json.get("messageType").asString
            val data = json.get("data")
            val messageId = json.get("messageId")?.asString

            val respond = fun(data: Any?) {
                sendToWebview(messageType, data, messageId ?: uuid())
            }

            if (PASS_THROUGH_TO_CORE.contains(messageType)) {
                project.service<ContinuePluginService>().coreMessenger?.request(messageType, data, messageId, respond)
                return@addHandler null
            }

            // If not pass through, then put it in the status/content/done format for webview
            // Core already sends this format
            val respondToWebview = fun(data: Any?) {
                sendToWebview(messageType, mapOf(
                    "status" to "success",
                    "content" to data,
                    "done" to true
                ), messageId ?: uuid())
            }

            if (msg != null) {
                project.service<ContinuePluginService>().ideProtocolClient?.handleMessage(msg, respondToWebview)
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

        // Load the url only after the protocolClient is initialized,
        // otherwise some messages will be lost, which are some configurations when the page is loaded.
        // Moreover, we should add LoadHandler before loading the url.
        project.service<ContinuePluginService>().onProtocolClientInitialized {
            browser.loadURL(url)
        }

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

    private fun registerAppSchemeHandler() {
        CefApp.getInstance().registerSchemeHandlerFactory(
            "http",
            "continue",
            CustomSchemeHandlerFactory()
        )
    }

    private fun buildJavaScript(jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }

}
