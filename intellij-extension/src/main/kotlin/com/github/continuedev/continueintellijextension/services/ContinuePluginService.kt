package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.toolWindow.ContinuePluginToolWindowFactory
import com.google.gson.Gson
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.*

@Service(Service.Level.PROJECT)
class ContinuePluginService(project: Project) : Disposable {
    val coroutineScope = CoroutineScope(Dispatchers.Main)
    val continuePluginWindow = ContinuePluginToolWindowFactory.ContinuePluginWindow(project)

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
        continuePluginWindow.webView.executeJavaScriptAsync(jsCode)
    }

    private fun buildJavaScript(type: String, jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }


}