package com.github.bishwenduk029.continueintellijextension.`continue`

interface WebSocketEventListener {
    fun onMessageReceived(message: String)
    fun onErrorOccurred(error: Throwable)
}