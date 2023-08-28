package com.github.bishwenduk029.continueintellijextension.`continue`

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import okhttp3.*

class IdeProtocolClient(
    private val serverUrl: String = "ws://localhost:65432/ide/ws",
    private val coroutineScope: CoroutineScope
) {
    private val eventListeners = mutableListOf<WebSocketEventListener>()
    private var okHttpClient: OkHttpClient = OkHttpClient()
    private var webSocket: WebSocket? = null

    private val textSelectionStrategy: TextSelectionStrategy = DefaultTextSelectionStrategy(this, coroutineScope)

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
        val respDeferred = sendAndReceive("getSessionId", mapOf<String, Any>())
        val resp = respDeferred.await()  // Awaiting the deferred response
        println(resp)
        val data = (resp as? Map<*, *>)?.get("data") as? Map<*, *>
        sessionId = data?.get("sessionId").toString()
        println("New Continue session with ID: $sessionId")
        sessionId
    }

    private val pendingResponses: MutableMap<String, CompletableDeferred<Any>> = mutableMapOf()

    fun sendAndReceive(messageType: String, data: Any): CompletableDeferred<Any> {
        val deferred = CompletableDeferred<Any>()
        pendingResponses[messageType] = deferred  // Store the deferred object for later resolution

        val sendData = mapOf("messageType" to messageType, "data" to data)
        val jsonMessage = convertToJson(sendData)

        sendMessage(messageType, jsonMessage)
        return deferred
    }

    private fun convertToJson(data: Map<String, Any>): String {
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
                    val parsedMessage: Map<String, Any> = Gson().fromJson(text, object : TypeToken<Map<String, Any>>() {}.type)
                    val messageType = parsedMessage["messageType"] as? String
                    if (messageType != null) {
                        pendingResponses[messageType]?.complete(parsedMessage)
                        pendingResponses.remove(messageType)
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
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

    fun sendMessage(type: String, message: String) {
        // TODO: Format your message here, if needed
        webSocket?.send(message)
    }

    fun onTextSelected(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ) {
        textSelectionStrategy.handleTextSelection(
            selectedText,
            filepath,
            startLine,
            startCharacter,
            endLine,
            endCharacter
        );
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
    )
}

class DefaultTextSelectionStrategy(
    private val client: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) : TextSelectionStrategy {

    private var lastActionJob: Job? = null
    private val debounceWaitMs = 100L

    override fun handleTextSelection(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ) {
        lastActionJob?.cancel()
        lastActionJob = coroutineScope.launch {
            delay(debounceWaitMs)
            val message = mapOf(
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

            val jsonMessage = convertToJson(message)
            client.sendMessage("HighlightedCode", jsonMessage)
        }
    }

    fun convertToJson(data: Map<String, Any>): String {
        val gson = Gson()
        return gson.toJson(data)
    }
}