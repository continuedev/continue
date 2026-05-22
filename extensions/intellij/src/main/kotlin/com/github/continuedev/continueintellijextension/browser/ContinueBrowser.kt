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
        if (browser.cefBrowser.isClosed) {
            log.warn("Attempted to send message to disposed browser: $messageType")
            return
        }
        val json = gsonService.gson.toJson(BrowserMessage(messageType, messageId, data))
        try {
            if (json.length <= CHUNKED_MESSAGE_THRESHOLD) {
                browser.cefBrowser.executeJavaScript(
                    """window.postMessage($json, "*");""", getGuiUrl(), 0
                )
            } else {
                sendChunked(json, messageId)
            }
        } catch (error: Exception) {
            log.warn(error)
        }
    }

    // Base64-encode and send in 512KB chunks to avoid JCEF freezing on large JS source strings
    private fun sendChunked(json: String, bufferId: String) {
        val scripts = buildChunkScripts(json, bufferId)
        val url = getGuiUrl()

        browser.cefBrowser.executeJavaScript(scripts.init, url, 0)

        try {
            for (chunkScript in scripts.chunks) {
                browser.cefBrowser.executeJavaScript(chunkScript, url, 0)
            }
            browser.cefBrowser.executeJavaScript(scripts.finalize, url, 0)
        } catch (e: Exception) {
            try {
                browser.cefBrowser.executeJavaScript(scripts.cleanup, url, 0)
            } catch (_: Exception) {}
            throw e
        }
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

    internal data class ChunkScripts(
        val init: String,
        val chunks: List<String>,
        val finalize: String,
        val cleanup: String,
    )

    internal companion object {
        internal const val CHUNKED_MESSAGE_THRESHOLD = 1 * 1024 * 1024 // 1MB
        internal const val CHUNK_SIZE = 2 * 1024 * 1024 // 2MB

        private fun getGuiUrl() =
            System.getenv("GUI_URL") ?: "http://continue/index.html"

        internal fun buildChunkScripts(json: String, bufferId: String, chunkSize: Int = CHUNK_SIZE): ChunkScripts {
            val encoded = Base64.getEncoder().encodeToString(json.toByteArray(Charsets.UTF_8))
            val chunks = mutableListOf<String>()

            var offset = 0
            while (offset < encoded.length) {
                val end = minOf(offset + chunkSize, encoded.length)
                val chunk = encoded.substring(offset, end)
                chunks.add("""window.__cc["$bufferId"].push("$chunk");""")
                offset = end
            }

            return ChunkScripts(
                init = """window.__cc=window.__cc||{};window.__cc["$bufferId"]=[];""",
                chunks = chunks,
                finalize = """try{var b=atob(window.__cc["$bufferId"].join(""));window.postMessage(JSON.parse(new TextDecoder().decode(Uint8Array.from(b,function(c){return c.charCodeAt(0)}))),"*")}
finally{delete window.__cc["$bufferId"]}""",
                cleanup = """delete window.__cc["$bufferId"];""",
            )
        }
    }

}