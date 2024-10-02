package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.activities.showTutorial
import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.webjars.*
import io.ktor.server.websocket.*
import io.ktor.util.cio.*
import io.ktor.util.date.*
import io.ktor.utils.io.*
import io.ktor.utils.io.jvm.javaio.*
import io.ktor.websocket.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import org.webjars.MultipleMatchesException
import java.io.InputStream
import java.time.Duration
import java.util.*

class ContinueBrowser(val project: Project, url: String, useOsr: Boolean = false,
                      splitMode: Boolean = false, staticResHost: String) {
    private val coroutineScope = CoroutineScope(
            SupervisorJob() + Dispatchers.Default
    )
    private val heightChangeListeners = mutableListOf<(Int) -> Unit>()
    fun onHeightChange(listener: (Int) -> Unit) {
        heightChangeListeners.add(listener)
    }

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

    val splitMode: Boolean
    val staticResHost: String
    var browser: JBCefBrowser? = null
    val activeSessions = Collections.synchronizedSet<DefaultWebSocketSession?>(LinkedHashSet())

    init {
        println("init Continue Browser splitMode:$splitMode")
        this.splitMode = splitMode
        this.staticResHost = staticResHost
        // Listen for events sent from browser
        if (splitMode) {
            // Ensure the server is started
            embeddedServer
            // Dynamically add WebSocket route for this project
            addProjectWebSocket(project, defaultWebsocketHandler(project))
            Disposer.register(project) { removeProjectWebSocket(project) }
        } else {
            this.browser = JBCefBrowser.createBuilder().setOffScreenRendering(useOsr).build()
            browser?.jbCefClient?.setProperty(
                    JBCefClient.Properties.JS_QUERY_POOL_SIZE,
                    JS_QUERY_POOL_SIZE
            )
            registerAppSchemeHandler()
            browser?.loadURL(url);
            Disposer.register(project, browser!!)
            val myJSQueryOpenInBrowser = JBCefJSQuery.create((browser as JBCefBrowserBase?)!!)
            myJSQueryOpenInBrowser.addHandler { msg: String? ->
                if (handleMsg(msg)) {
                    return@addHandler null
                }
                null
            }
            // Listen for the page load event
            browser?.jbCefClient?.addLoadHandler(object : CefLoadHandlerAdapter() {
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
            }, browser!!.cefBrowser)
        }
    }

    companion object EmbeddedServer {
        private var routing: Routing? = null
        var serverHost: String? = null
        var serverPort: String? = null
        val embeddedServer: ApplicationEngine by lazy {
            println("starting embedded server with port:$serverPort, token:$serverToken")
            embeddedServer(Netty, host = serverHost!!, port = Integer.parseInt(serverPort!!)) {
                install(CORS) {
//                    allowHost("localhost:5173", schemes = listOf("http", "https","ws","wss"))
//                    allowHeader(HttpHeaders.ContentType)
                    anyHost()

                }
                install(customWebJars)
//                install(Authentication) {
//                    bearer("auth-bearer") {
//                        realm = "continue"
//                        authenticate { tokenCred ->
//                            if (tokenCred.token == serverToken) {
//                                UserIdPrincipal("continue")
//                            } else {
//                                null
//                            }
//                        }
//                    }
//                }
                install(WebSockets) {
                    pingPeriod = Duration.ofSeconds(15)
                    timeout = Duration.ofSeconds(15)
                    maxFrameSize = Long.MAX_VALUE
                    masking = false
                }
                routing = install(Routing) {
                    webSocket("/projects") {
                        println("list all projects");
//                        send(Frame.Text("list all projects"))
                        var authed = false
                        for (frame in incoming) {
                            try {
                                frame as? Frame.Text ?: continue
                                val receivedText = frame.readText()
                                authed = authedFilter(authed, receivedText) { msg ->
                                    when (msg) {
                                        "list" -> {
                                            val projectPathPrefix = routing?.children?.firstOrNull { it.toString() == "/project" }
                                            val result = projectPathPrefix?.children?.joinToString(",") { it.selector.toString() }
                                                    ?: ""
                                            send(Frame.Text("[$result]"))
                                        }

                                        else -> {
                                            send(Frame.Text("unsupport operation"))
                                        }
                                    }
                                }
                            } catch (e: Exception) {
                                println("list all projects error: $e");
                            }
                        }
                    }
                }
            }.start()
        }


        var serverToken: String? = null
        suspend fun DefaultWebSocketServerSession.authedFilter(authed: Boolean, receivedText: String, msgHandler: suspend (String) -> Unit): Boolean {
            var result = authed
            if (receivedText == "auth") {
                val status = if (authed) "succ" else "failed"
                send(Frame.Text("auth $status"))
            } else if (receivedText == serverToken) {
                result = true
                println("auth succ by $receivedText")
                send(Frame.Text("auth succ"))
            } else if (authed) {
                msgHandler(receivedText)
            } else {
                println("auth failed, token:$receivedText, correct: $serverToken")
                send(Frame.Text("auth failed|$receivedText"))
            }
            return result
        }
    }

    fun addProjectWebSocket(project: Project, handler: suspend DefaultWebSocketServerSession.() -> Unit) {
        val path = "/project/${project.name}"
        val routeExists = routing?.children?.firstOrNull { it.selector.toString() == path }
        if (routeExists != null) {
            println("dynamic routing $path already exists, route:$routeExists")
            return
        }
        routing?.webSocket(path, handler = handler)
        println("dynamic routing $path register succ")
    }

    fun removeProjectWebSocket(project: Project) {
        val path = "/project/${project.name}"
        // 查找对应的路由
        val routeExists = routing?.children?.firstOrNull { it.selector.toString() == path }
        // 如果找到了对应的路由，则从父节点移除它
        if (routeExists == null) {
            println("dynamic routing $path not found")
        }
        (routing?.children as MutableList<Route>).remove(routeExists)
        println("dynamic routing $path removed successfully")
    }

    private fun defaultWebsocketHandler(project: Project): suspend DefaultWebSocketServerSession.() -> Unit = {
        val local = this.call.request.local
        var authed = false
        println("new connection, project:${project.name}, remoteHost: ${local.remoteHost}")
        for (frame in incoming) {
            try {
                frame as? Frame.Text ?: continue
                val receivedText = frame.readText()
                println("received from webview, project:${project.name}, data:$receivedText")
                authed = authedFilter(authed, receivedText) { msg ->
                    handleMsg(msg)
                }
                if(authed){
                    activeSessions.add(this)
                }
            } catch (e: Exception) {
                val msg = "received from webview error, project:${project.name},  e:$e"
                println(msg)
                send(Frame.Text(msg))
            }
        }
        println("connection lost, project:${project.name}, ${local.remoteHost}")
        activeSessions.remove(this)
    }

    /**
     * @return needTransfer2Core
     */
    private fun handleMsg(msg: String?): Boolean {
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
            return true
        }
        handleIdeActionMsg(messageType, data ?: JsonObject(), continuePluginService, respond, ide, msg)
        return false
    }

    private fun handleIdeActionMsg(messageType: String?, data: JsonElement, continuePluginService: ContinuePluginService, respond: (Any?) -> Unit, ide: IdeProtocolClient?, msg: String?) {
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
                            "vscMediaUrl" to  "http://$staticResHost",
                    )
                    respond(jsonData)
                }

            }

            "showLines" -> {
                val data = data.asJsonObject
                ide?.setFileOpen(data.get("filepath").asString)
                ide?.highlightCode(RangeInFile(
                        data.get("filepath").asString,
                        Range(Position(
                                data.get("start").asInt,
                                0
                        ), Position(
                                data.get("end").asInt,
                                0
                        )),

                        ), "#00ff0022")
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
        if (this.splitMode) {
            coroutineScope.launch {
                val emptySessions = activeSessions.isEmpty()
                if (!emptySessions) {
                    println("send to webview, project:${project.name}, data:$jsonData")
                    activeSessions.forEach {
                        it?.send(Frame.Text(jsonData))
                    }
                }
            }
            return
        }
        val jsCode = buildJavaScript(jsonData)

        try {
            this.browser?.executeJavaScriptAsync(jsCode)
        } catch (error: IllegalStateException) {
            println("Webview not initialized yet $error")
        }
    }

    private fun buildJavaScript(jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }
}

class InputStreamContent(
        val input: InputStream,
        override val contentType: ContentType,
        lastModified: GMTDate
) : OutgoingContent.ReadChannelContent() {
    init {
        versions += LastModifiedVersion(lastModified)
    }

    override fun readFrom(): ByteReadChannel = input.toByteReadChannel(pool = KtorDefaultPool)
}

val customWebJars: ApplicationPlugin<WebjarsConfig> = createApplicationPlugin("Webjars", ::WebjarsConfig) {
//    val webjarsPrefix = pluginConfig.path
//    require(webjarsPrefix.startsWith("/"))
//    require(webjarsPrefix.endsWith("/"))
    val lastModified = GMTDate()
    onCall { call ->
        if (call.response.isCommitted) return@onCall
        val originPath = call.request.path()
        var fullPath = originPath
        if (fullPath == "/") {
            fullPath += "/index.html"
        }
        if (call.request.httpMethod == HttpMethod.Get) {
//            (fullPath.startsWith("/asset") || fullPath == "/index.html")
            val resourcePath = "webview$fullPath";
            println("webJars: originPath:$originPath, resourcePath:$resourcePath")
            try {
                val stream = WebjarsConfig::class.java.classLoader.getResourceAsStream(resourcePath)
                        ?: return@onCall
                val content = InputStreamContent(stream, ContentType.defaultForFilePath(fullPath), lastModified)
                call.respond(content)
            } catch (multipleFiles: MultipleMatchesException) {
                call.respond(HttpStatusCode.InternalServerError)
            } catch (_: IllegalArgumentException) {
            }
        }
    }
}