package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.toolWindow.ContinuePluginToolWindowFactory
import com.google.gson.Gson
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@Service(Service.Level.PROJECT)
class ContinuePluginService(project: Project) : Disposable {
    val coroutineScope = CoroutineScope(Dispatchers.Main)
    var continuePluginWindow: ContinuePluginToolWindowFactory.ContinuePluginWindow? = null

    var ideProtocolClient: IdeProtocolClient? = null
    var sessionId: String? = null
    var worksapcePaths: Array<String>? = null

    override fun dispose() {
        coroutineScope.cancel()
    }

    fun launchInScope(block: suspend CoroutineScope.() -> Unit) {
        coroutineScope.launch {
            block()
        }
    }

    fun dispatchCustomEvent(
        type: String,
        data: Map<String, Any>
    ) {
        val gson = Gson()
        val jsonData = gson.toJson(data)
        val jsCode = buildJavaScript(type, jsonData)

        try {
            continuePluginWindow?.webView?.executeJavaScriptAsync(jsCode)
        } catch (error: IllegalStateException) {
            println("Webview not initialized yet $error")
        }
    }

    private fun buildJavaScript(type: String, jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }


}