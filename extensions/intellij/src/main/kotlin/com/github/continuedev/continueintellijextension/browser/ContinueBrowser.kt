package com.github.continuedev.continueintellijextension.browser

import com.github.continuedev.continueintellijextension.constants.MessageTypes
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.services.GsonService
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import java.util.Base64
import javax.swing.JComponent

class ContinueBrowser(
    private val project: Project,
    private val gsonService: GsonService = service<GsonService>(),
): Disposable {

    private val log = Logger.getInstance(ContinueBrowser::class.java.simpleName)
    private val browser: JBCefBrowser = JBCefBrowser.createBuilder().setOffScreenRendering(true).build()
    private val myJSQueryOpenInBrowser = JBCefJSQuery.create(browser as JBCefBrowserBase)

    init {
        CefApp.getInstance().registerSchemeHandlerFactory("http", "continue", CustomSchemeHandlerFactory())
        browser.jbCefClient.setProperty(JBCefClient.Properties.JS_QUERY_POOL_SIZE, 200)
        myJSQueryOpenInBrowser.addHandler { msg: String? ->
            val json = gsonService.gson.fromJson(msg, BrowserMessage::class.java)
            val messageType = json.messageType
            val data = json.data
            val messageId = json.messageId

            if (MessageTypes.PASS_THROUGH_TO_CORE.contains(messageType)) {
                project.service<ContinuePluginService>().coreMessenger?.request(messageType, data, messageId) { data ->
                    sendToWebview(messageType, data, messageId ?: uuid())
                }
                return@addHandler null
            }

            // If not pass through, then put it in the status/content/done format for webview
            // Core already sends this format
            if (msg != null) {
                project.service<ContinuePluginService>().ideProtocolClient?.handleMessage(msg) { data ->
                    sendToWebview(
                        messageType,
                        mapOf(
                            "status" to "success",
                            "content" to data,
                            "done" to true
                        ),
                        messageId ?: uuid()
                    )
                }
            }

            null
        }

        browser.jbCefClient.addLoadHandler(OnPageLoad {
            executeJavaScript(myJSQueryOpenInBrowser)
        }, browser.cefBrowser)

        // Load the url only after the protocolClient is initialized,
        // otherwise some messages will be lost, which are some configurations when the page is loaded.
        // Moreover, we should add LoadHandler before loading the url.
        project.service<ContinuePluginService>().onProtocolClientInitialized {
            browser.loadURL(getGuiUrl())
        }

        browser.createImmediately()
    }

    fun getComponent(): JComponent =
        browser.component

    fun focusOnInput() {
        browser.component.components?.get(0)?.requestFocus()
    }

    fun openDevTools() {
        browser.openDevtools()
    }

    fun sendToWebview(messageType: String, data: Any? = null, messageId: String = uuid()) {
        val json = gsonService.gson.toJson(BrowserMessage(messageType, messageId, data))
        try {
            if (json.length <= CHUNKED_MESSAGE_THRESHOLD) {
                browser.cefBrowser.executeJavaScript(
                    """window.postMessage($json, "*");""", getGuiUrl(), 0
                )
            } else {
                sendChunked(json, messageId)
            }
        } catch (error: IllegalStateException) {
            log.warn(error)
        }
    }

    // Base64-encode and send in 512KB chunks to avoid JCEF freezing on large JS source strings
    private fun sendChunked(json: String, bufferId: String) {
        val encoded = Base64.getEncoder().encodeToString(json.toByteArray(Charsets.UTF_8))
        val url = getGuiUrl()

        browser.cefBrowser.executeJavaScript(
            """window.__cc=window.__cc||{};window.__cc["$bufferId"]="";""", url, 0
        )

        var offset = 0
        while (offset < encoded.length) {
            val end = minOf(offset + CHUNK_SIZE, encoded.length)
            val chunk = encoded.substring(offset, end)
            browser.cefBrowser.executeJavaScript(
                """window.__cc["$bufferId"]+="$chunk";""", url, 0
            )
            offset = end
        }

        browser.cefBrowser.executeJavaScript("""
            try{window.postMessage(JSON.parse(atob(window.__cc["$bufferId"])),"*")}
            finally{delete window.__cc["$bufferId"]}
        """.trimIndent(), url, 0)
    }

    private fun executeJavaScript(myJSQueryOpenInBrowser: JBCefJSQuery) {
        val script = """
            window.postIntellijMessage = function(messageType, data, messageId) {
                const msg = JSON.stringify({messageType, data, messageId});
                ${myJSQueryOpenInBrowser.inject("msg")}
            }
            """
        browser.cefBrowser.executeJavaScript(script, getGuiUrl(), 0)
    }

    override fun dispose() {
        Disposer.dispose(myJSQueryOpenInBrowser)
        Disposer.dispose(browser)
    }

    // todo: remove and use types.Message
    private data class BrowserMessage(
        val messageType: String,
        val messageId: String?,
        val data: Any?
    )

    private class OnPageLoad(
        private val onLoad: () -> Unit
    ) : CefLoadHandlerAdapter() {
        override fun onLoadingStateChange(
            browser: CefBrowser?,
            isLoading: Boolean,
            canGoBack: Boolean,
            canGoForward: Boolean
        ) {
            if (!isLoading)
                onLoad()
        }
    }

    private companion object {
        private const val CHUNKED_MESSAGE_THRESHOLD = 1 * 1024 * 1024 // 1MB
        private const val CHUNK_SIZE = 512 * 1024 // 512KB

        private fun getGuiUrl() =
            System.getenv("GUI_URL") ?: "http://continue/index.html"
    }

}