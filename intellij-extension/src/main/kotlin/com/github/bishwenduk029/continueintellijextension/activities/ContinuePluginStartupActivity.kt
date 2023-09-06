package com.github.bishwenduk029.continueintellijextension.activities

import com.github.bishwenduk029.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.bishwenduk029.continueintellijextension.`continue`.IdeProtocolClient
import com.github.bishwenduk029.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.bishwenduk029.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow

object SessionStore {
    val sessionId: MutableStateFlow<String?> = MutableStateFlow(null)
}


class ContinuePluginStartupActivity : StartupActivity, Disposable {
    val coroutineScope = CoroutineScope(Dispatchers.IO)

    override fun runActivity(project: Project) {
        val client = IdeProtocolClient("ws://localhost:65432/ide/ws", coroutineScope)
        val defaultStrategy = DefaultTextSelectionStrategy(client, coroutineScope)
        val listener = ContinuePluginSelectionListener(defaultStrategy)

        coroutineScope.launch {
            val newSessionId = client.getSessionIdAsync().await()
            val sessionId = newSessionId ?: ""

            // After sessionID fetched
            withContext(Dispatchers.Main) {
                val toolWindowManager = ToolWindowManager.getInstance(project)
                val toolWindow = toolWindowManager.getToolWindow("ContinuePluginViewer")
                toolWindow?.show()

                // Assuming ContinuePluginService is your service where the ToolWindow is registered
                val continuePluginService = ServiceManager.getService(project, ContinuePluginService::class.java)

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
                    dispatchCustomEvent("onUILoad", dataMap, continuePluginService.continuePluginWindow.webView)
                }
            }
            EditorFactory.getInstance().eventMulticaster.addSelectionListener(listener, this@ContinuePluginStartupActivity)
        }
    }

    private fun CoroutineScope.dispatchCustomEvent(
        type: String,
        data: Map<String, Any>,
        webView: JBCefBrowser
    ) {
        launch(CoroutineExceptionHandler { _, exception ->
            println("Failed to dispatch custom event: ${exception.message}")
        }) {
            val gson = Gson()
            val jsonData = gson.toJson(data)
            val jsCode = buildJavaScript(type, jsonData)
            webView.executeJavaScriptAsync(jsCode)
        }
    }

    private fun buildJavaScript(type: String, jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }



    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}