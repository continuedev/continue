package com.github.continuedev.continueintellijextension.listeners

import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*

/**
 * Tracks document changes to detect typing sessions and manage active handlers.
 */
@Service(Service.Level.PROJECT)
class DocumentChangeTracker(private val project: Project) : DocumentListener {

    private val coroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var typingHandler: TypingSessionHandler? = null
    private var typingSessionTimer: Job? = null

    private val TYPING_SESSION_TIMEOUT = 2000L // ms

    override fun documentChanged(event: DocumentEvent) {
        if (event.document.isWritable) {
            handleDocumentChange()
        }
    }

    private fun handleDocumentChange() {
        val activeHandlerManager = project.service<ActiveHandlerManager>()

        // Cancel existing typing session timer
        typingSessionTimer?.cancel()

        // If no active handler or it's not already a typing session, create one
        val currentHandler = activeHandlerManager.getActiveHandler()
        if (currentHandler !is TypingSessionHandler) {
            typingHandler = TypingSessionHandler(project)
            activeHandlerManager.setActiveHandler(typingHandler!!)
        } else {
            // Update existing typing handler
            (currentHandler as TypingSessionHandler).updateTypingTime()
        }

        // Set up timer to clear typing session after inactivity
        typingSessionTimer = coroutineScope.launch {
            delay(TYPING_SESSION_TIMEOUT)

            // Clear typing handler if it's still active
            if (activeHandlerManager.isHandlerActive("typingSession")) {
                activeHandlerManager.clearActiveHandler()
                typingHandler?.dispose()
                typingHandler = null
            }
        }
    }

    fun dispose() {
        typingSessionTimer?.cancel()
        typingHandler?.dispose()
        coroutineScope.cancel()
    }
}