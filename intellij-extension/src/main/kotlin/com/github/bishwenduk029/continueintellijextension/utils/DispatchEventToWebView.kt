package com.github.bishwenduk029.continueintellijextension.utils

import com.google.gson.Gson
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

fun CoroutineScope.dispatchEventToWebview(
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