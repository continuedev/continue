package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.`continue`.CoreMessenger
import com.github.continuedev.continueintellijextension.`continue`.CoreMessengerManager
import com.github.continuedev.continueintellijextension.`continue`.DiffManager
import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.toolWindow.ContinuePluginToolWindowFactory
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.DumbAware
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlin.properties.Delegates

@Service(Service.Level.PROJECT)
class ContinuePluginService : Disposable, DumbAware {
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    var continuePluginWindow: ContinuePluginToolWindowFactory.ContinuePluginWindow? = null
    var listener: (() -> Unit)? = null
    var ideProtocolClient: IdeProtocolClient? by Delegates.observable(null) { _, _, _ ->
        synchronized(this) { listener?.also { listener = null }?.invoke() }
    }
    var coreMessengerManager: CoreMessengerManager? = null
    val coreMessenger: CoreMessenger?
        get() = coreMessengerManager?.coreMessenger
    var workspacePaths: Array<String>? = null
    var windowId: String = uuid()
    var diffManager: DiffManager? = null

    override fun dispose() {
        coroutineScope.cancel()
        coreMessenger?.coroutineScope?.let {
            it.cancel()
            coreMessenger?.close()
        }
    }

    fun sendToWebview(
        messageType: String,
        data: Any?,
        messageId: String = uuid()
    ) {
        continuePluginWindow?.browser?.sendToWebview(messageType, data, messageId)
    }

    /**
     * Add a listener for protocolClient initialization.
     * Currently, only one needs to be processed. If there are more than one,
     * we can use an array to add listeners to ensure that the message is processed.
     */
    fun onProtocolClientInitialized(listener: () -> Unit) {
        if (ideProtocolClient == null) {
            synchronized(this) {
                if (ideProtocolClient == null) {
                    this.listener = listener
                } else {
                    listener()
                }
            }
        } else {
            listener()
        }
    }
}