package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.constants.MessageTypes
import com.github.continuedev.continueintellijextension.`continue`.process.ContinueBinaryProcess
import com.github.continuedev.continueintellijextension.`continue`.process.ContinueProcessHandler
import com.github.continuedev.continueintellijextension.`continue`.process.ContinueSocketProcess
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.uuid
import com.google.gson.Gson
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*

class CoreMessenger(
    private val project: Project,
    private val ideProtocolClient: IdeProtocolClient,
    val coroutineScope: CoroutineScope,
    private val onExit: () -> Unit
) {
    private val gson = Gson()
    private val responseListeners = mutableMapOf<String, (Any?) -> Unit>()
    private val process = startContinueProcess()

    fun request(messageType: String, data: Any?, messageId: String?, onResponse: (Any?) -> Unit) {
        val id = messageId ?: uuid()
        val message = gson.toJson(mapOf("messageId" to id, "messageType" to messageType, "data" to data))
        responseListeners[id] = onResponse
        process.write(message)
    }

    private fun startContinueProcess(): ContinueProcessHandler {
        val isTcp = System.getenv("USE_TCP")?.toBoolean() ?: false
        val process = if (isTcp)
            ContinueSocketProcess()
        else
            ContinueBinaryProcess(onExit)
        return ContinueProcessHandler(coroutineScope, process, ::handleMessage)
    }

    private fun handleMessage(json: String) {
        val responseMap = gson.fromJson(json, Map::class.java)
        val messageId = responseMap["messageId"].toString()
        val messageType = responseMap["messageType"].toString()
        val data = responseMap["data"]

        // IDE listeners
        if (MessageTypes.IDE_MESSAGE_TYPES.contains(messageType)) {
            ideProtocolClient.handleMessage(json) { data ->
                val message = gson.toJson(mapOf("messageId" to messageId, "messageType" to messageType, "data" to data))
                process.write(message)
            }
        }

        // Forward to webview
        if (MessageTypes.PASS_THROUGH_TO_WEBVIEW.contains(messageType)) {
            val continuePluginService = project.service<ContinuePluginService>()
            continuePluginService.sendToWebview(messageType, responseMap["data"], messageType)
        }

        // Responses for messageId
        responseListeners[messageId]?.let { listener ->
            listener(data)
            val done = (data as Map<String, Boolean>)["done"]

            if (done == true) {
                responseListeners.remove(messageId)
            }
        }
    }

    fun killSubProcess() {
        process.close()
    }
}