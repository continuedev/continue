package com.github.bishwenduk029.continueintellijextension.activities

import com.github.bishwenduk029.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.bishwenduk029.continueintellijextension.`continue`.IdeProtocolClient
import com.github.bishwenduk029.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.bishwenduk029.continueintellijextension.services.ContinuePluginService
import com.github.bishwenduk029.continueintellijextension.utils.dispatchEventToWebview
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.wm.ToolWindowManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow

object SessionStore {
    val sessionId: MutableStateFlow<String?> = MutableStateFlow(null)
}


class ContinuePluginStartupActivity : StartupActivity, Disposable {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    override fun runActivity(project: Project) {
        val continuePluginService = ServiceManager.getService(project, ContinuePluginService::class.java)

        val defaultStrategy = DefaultTextSelectionStrategy()

        val ideProtocolClient = IdeProtocolClient("ws://localhost:65432/ide/ws", continuePluginService, defaultStrategy, coroutineScope)

        val listener = ContinuePluginSelectionListener(ideProtocolClient, coroutineScope)

        coroutineScope.launch {
            val newSessionId = ideProtocolClient.getSessionIdAsync().await()
            val sessionId = newSessionId ?: ""

            // After sessionID fetched
            withContext(Dispatchers.Main) {
                val toolWindowManager = ToolWindowManager.getInstance(project)
                val toolWindow = toolWindowManager.getToolWindow("ContinuePluginViewer")
                toolWindow?.show()

                // Reload the WebView
                continuePluginService?.let {
                    val dataMap = mutableMapOf(
                            "type" to "onUILoad",
                            "sessionId" to sessionId,
                            "apiUrl" to "http://localhost:65432",
                            "workspacePaths" to emptyList<String>(),  // or your actual workspace paths
                            "vscMachineId" to "yourMachineId",
                            "vscMediaUrl" to "yourMediaUrl",
                            "dataSwitchOn" to true  // or your actual condition
                        )
                    dispatchEventToWebview("onUILoad", dataMap, continuePluginService.continuePluginWindow.webView)
                }
            }
            EditorFactory.getInstance().eventMulticaster.addSelectionListener(listener, this@ContinuePluginStartupActivity)
        }
    }


    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}