package com.github.continuedev.continueintellijextension.`continue`

interface WebSocketEventListener {
    fun onMessageReceived(message: String)
    fun onErrorOccurred(error: Throwable)
}