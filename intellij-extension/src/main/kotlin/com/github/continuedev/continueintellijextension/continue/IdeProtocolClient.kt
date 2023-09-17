package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.dispatchEventToWebview
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import okhttp3.*
import java.net.NetworkInterface

data class WebSocketMessage<T>(val messageType: String, val data: T)
data class WorkspaceDirectory(val workspaceDirectory: String);
data class UniqueId(val uniqueId: String);

fun getMachineUniqueID(): String {
    val sb = StringBuilder()
    val networkInterfaces = NetworkInterface.getNetworkInterfaces()

    while (networkInterfaces.hasMoreElements()) {
        val networkInterface = networkInterfaces.nextElement()
        val mac = networkInterface.hardwareAddress

        if (mac != null) {
            for (i in mac.indices) {
                sb.append(String.format("%02X%s", mac[i], if (i < mac.size - 1) "-" else ""))
            }
            return sb.toString()
        }
    }

    return "No MAC Address Found"
}

class IdeProtocolClient(
    private val serverUrl: String = "ws://localhost:65432/ide/ws",
    private val continuePluginService: ContinuePluginService,
    private val textSelectionStrategy: TextSelectionStrategy,
    private val coroutineScope: CoroutineScope,
    private val workspacePath: String
) {
    private val eventListeners = mutableListOf<WebSocketEventListener>()
    private var okHttpClient: OkHttpClient = OkHttpClient()
    private var webSocket: WebSocket? = null

    init {
        initWebSocket()
    }

    var sessionId: String? = null

    fun getSessionIdAsync(): Deferred<String?> = coroutineScope.async {
        withTimeoutOrNull(10000) {
            while ((webSocket?.queueSize() ?: 0) > 0) {
                delay(1000)
            }
        }
        println("Getting session ID")
        val respDeferred = sendAndReceive("getSessionId", mapOf())
        val resp = respDeferred.await()  // Awaiting the deferred response
        println(resp)
        val data = (resp as? Map<*, *>)?.get("data") as? Map<*, *>
        sessionId = data?.get("sessionId").toString()
        println("New Continue session with ID: $sessionId")
        sessionId
    }

    private val pendingResponses: MutableMap<String, CompletableDeferred<Any>> =
        mutableMapOf()

    fun sendAndReceive(
        messageType: String,
        data: Map<String, Any>
    ): CompletableDeferred<Any> {
        val deferred = CompletableDeferred<Any>()
        pendingResponses[messageType] =
            deferred  // Store the deferred object for later resolution

        sendMessage(messageType, data)
        return deferred
    }

    private fun serializeMessage(data: Map<String, Any>): String {
        val gson = Gson()
        return gson.toJson(data)
    }

    private fun initWebSocket() {
        val webSocketListener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // handle onOpen
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                coroutineScope.launch(Dispatchers.Main) {
                    val parsedMessage: Map<String, Any> = Gson().fromJson(
                        text,
                        object : TypeToken<Map<String, Any>>() {}.type
                    )
                    val messageType = parsedMessage["messageType"] as? String
                    if (messageType != null) {
                        if (messageType == "workspaceDirectory") {
                            webSocket.send(
                                Gson().toJson(
                                    WebSocketMessage(
                                        "workspaceDirectory",
                                        WorkspaceDirectory(workspaceDirectory())
                                    )
                                )
                            );
                        } else if (messageType == "uniqueId") {
                            webSocket.send(
                                Gson().toJson(
                                    WebSocketMessage(
                                        "uniqueId",
                                        UniqueId(uniqueId())
                                    )
                                )
                            );
                        }
                        pendingResponses[messageType]?.complete(parsedMessage)
                        pendingResponses.remove(messageType)
                    }
                }
            }

            override fun onFailure(
                webSocket: WebSocket,
                t: Throwable,
                response: Response?
            ) {
                eventListeners.forEach { it.onErrorOccurred(t) }
            }
        }
        val request = Request.Builder()
            .url(serverUrl)
            .build()

        webSocket = okHttpClient.newWebSocket(request, webSocketListener)
    }

    fun addEventListener(listener: WebSocketEventListener) {
        eventListeners.add(listener)
    }

    fun connect() {
        // Connection is handled automatically by OkHttp
    }

    fun disconnect() {
        webSocket?.close(1000, null)
    }

    private fun sendMessage(messageType: String, message: Map<String, Any>) {
        val sendData = mapOf("messageType" to messageType, "data" to message)
        val jsonMessage = serializeMessage(sendData)
        webSocket?.send(jsonMessage)
    }

    fun workspaceDirectory(): String {
        return this.workspacePath
    }

    fun uniqueId(): String {
        return getMachineUniqueID()
    }

    fun onTextSelected(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ) = coroutineScope.launch {
        val jsonMessage = textSelectionStrategy.handleTextSelection(
            selectedText,
            filepath,
            startLine,
            startCharacter,
            endLine,
            endCharacter
        );
        sendMessage("highlightedCodePush", jsonMessage)
        dispatchEventToWebview(
            "highlightedCode",
            jsonMessage,
            continuePluginService.continuePluginWindow.webView
        )
    }
}

interface TextSelectionStrategy {
    fun handleTextSelection(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ): Map<String, Any>
}

class DefaultTextSelectionStrategy : TextSelectionStrategy {

    override fun handleTextSelection(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ): Map<String, Any> {

        return mapOf(
            "highlightedCode" to arrayOf(
                mapOf(
                    "filepath" to filepath,
                    "contents" to selectedText,
                    "range" to mapOf(
                        "start" to mapOf(
                            "line" to startLine,
                            "character" to startCharacter
                        ),
                        "end" to mapOf(
                            "line" to endLine,
                            "character" to endCharacter
                        )
                    )
                )
            )
        )
    }
}