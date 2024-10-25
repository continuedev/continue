package com.github.continuedev.continueintellijextension.utils

import com.google.gson.Gson
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

fun CoroutineScope.dispatchEventToWebview(
    type: String,
    data: Map<String, Any>,
    webView: JBCefBrowser?
) {
    if (webView == null) return
    val gson = Gson()
    val jsonData = gson.toJson(data)
    val jsCode = buildJavaScript(type, jsonData)
    
    launch(CoroutineExceptionHandler { _, exception ->
        println("Failed to dispatch custom event: ${exception.message}")
    }) {
        while (true) {
            try {
                webView.executeJavaScriptAsync(jsCode)
                break  // If the JS execution is successful, break the loop
            } catch (e: IllegalStateException) {
                delay(1000)  // If an error occurs, wait for 1 second and then retry
            }
        }
    }
}

fun CoroutineScope.runJsInWebview(
    jsCode: String,
    webView: JBCefBrowser?
) {
    if (webView == null) return
    launch(CoroutineExceptionHandler { _, exception ->
        println("Failed to dispatch custom event: ${exception.message}")
    }) {
        while (true) {
            try {
                webView.executeJavaScriptAsync(jsCode)
                break  // If the JS execution is successful, break the loop
            } catch (e: IllegalStateException) {
                delay(1000)  // If an error occurs, wait for 1 second and then retry
            }
        }
    }
}

private fun buildJavaScript(type: String, jsonData: String): String {
    return """window.postMessage($jsonData, "*");"""
}