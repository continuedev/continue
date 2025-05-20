/**
 * Notes:
 * - `sendIntellijMessage` isn't working, but keeping this around as an example of how we might be able to implement
 * - Below is an AI generated summary of what the problem might be based on troubleshooting attempts
 * - For details, see https://intellij-support.jetbrains.com/hc/en-us/community/posts/26714246086162--intellij-ui-test-robot-Error-when-attempting-to-click-on-DomElement-491
 *
 *
 * The issue is with how the JCefBrowserFixture.executeJsInBrowser method handles JavaScript code execution.
 * When trying to call window.postIntellijMessage, we're encountering these challenges:
 *
 * 1. **Double Injection Problem**: The postIntellijMessage function already uses JBCefJSQuery.inject internally.
 * When we try to call it through executeJsInBrowser, we're essentially trying to pass it through another injection
 * mechanism, creating nested injections that break.
 *
 * 2. **String Escaping Issues**: The way quotes are being escaped between the layers of execution is causing syntax
 * errors in the final JavaScript that gets executed.
 *
 * 3. **Context Isolation**: The executeJsInBrowser method likely runs in a different execution context than where the
 * function was defined, causing scope/reference issues.
 *
 * The key insight is that we cannot directly call a function that itself uses the JBCefJSQuery bridge through the test
 * framework's executeJsInBrowser method. These bridge functions are designed to be called directly in the browser
 * context, not through another layer of script injection.
 */
package com.github.continuedev.continueintellijextension.utils

import com.intellij.remoterobot.fixtures.JCefBrowserFixture

/**
 * Utility functions for interacting with browser components in tests
 */
object BrowserUtils {

    /**
     * Sends a message to the webview using JCefBrowserFixture's executeJsInBrowser
     *
     * @param browser The JCefBrowserFixture to execute JavaScript in
     * @param messageType The type of message to send
     * @param messageData The data object to send as message payload
     * @param messageId A unique ID for the message
     */
    fun sendIntellijMessage(
        browser: JCefBrowserFixture,
        messageType: String,
        messageData: Any,
        messageId: String = "test-message-id"
    ) {
        // Convert the messageData to a JSON string
        val dataJson = when (messageData) {
            is String -> "\"$messageData\""
            else -> messageData.toString()
        }

        val jsCode = """
            (function() {
                window.postIntellijMessage(
                    "$messageType",
                    $dataJson,
                    "$messageId"
                );
                return true;
            })();
        """.trimIndent()

        browser.executeJsInBrowser(jsCode)
    }
}

// Extension function for JCefBrowserFixture for easier usage
fun JCefBrowserFixture.sendIntellijMessage(
    messageType: String,
    messageData: Any,
    messageId: String = "test-message-id"
) {
    BrowserUtils.sendIntellijMessage(this, messageType, messageData, messageId)
}