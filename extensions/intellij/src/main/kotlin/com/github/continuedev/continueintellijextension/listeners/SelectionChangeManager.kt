package com.github.continuedev.continueintellijextension.listeners

import com.github.continuedev.continueintellijextension.nextEdit.NextEditService
import com.github.continuedev.continueintellijextension.nextEdit.NextEditJumpManager
import com.github.continuedev.continueintellijextension.nextEdit.NextEditWindowManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.ConcurrentLinkedQueue

enum class HandlerPriority(val value: Int) {
    CRITICAL(5),
    HIGH(4),
    NORMAL(3),
    LOW(2),
    FALLBACK(1)
}

data class StateSnapshot(
    val nextEditWindowAccepted: Boolean,
    val jumpInProgress: Boolean,
    val jumpJustAccepted: Boolean,
    val lastDocumentChangeTime: Long,
    val isTypingSession: Boolean,
    val document: Document?,
    val cursorPosition: LogicalPosition?
)

typealias SelectionChangeHandler = suspend (SelectionEvent, StateSnapshot) -> Boolean

data class HandlerRegistration(
    val id: String,
    val priority: Int,
    val handler: SelectionChangeHandler
)

@Service(Service.Level.PROJECT)
class SelectionChangeManager(private val project: Project) : SelectionListener, DumbAware {
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private val listeners = mutableListOf<HandlerRegistration>()

    // Event processing
    private val eventQueue = ConcurrentLinkedQueue<SelectionEvent>()
    private var lastEventTime = 0L
    private var isProcessingEvent = false
    private val processingMutex = Mutex()
    private var processingJob: Job? = null

    // Debounce settings
    private val DEBOUNCE_DELAY = 50L
    private val PROCESSING_TIMEOUT = 500L

    // Track typing session state
    private var isTypingSession = false
    private var typingTimer: Job? = null
    private var lastDocumentChangeTime = 0L
    private val TYPING_SESSION_TIMEOUT = 2000L

    init {
        // Register the default fallback handler
        registerListener(
            "defaultFallbackHandler",
            ::defaultFallbackHandler,
            HandlerPriority.FALLBACK
        )
    }

    fun documentChanged() {
        isTypingSession = true
        lastDocumentChangeTime = System.currentTimeMillis()
        resetTypingSession()
    }

    private fun resetTypingSession() {
        typingTimer?.cancel()
        typingTimer = coroutineScope.launch {
            delay(TYPING_SESSION_TIMEOUT)
            isTypingSession = false
        }
    }

    /**
     * Register a listener for the selection change event.
     * @param id Unique id for this handler.
     * @param handler Function to handle the event.
     * @param priority Higher priority runs first.
     * @return Function to unregister this listener.
     */
    fun registerListener(
        id: String,
        handler: SelectionChangeHandler,
        priority: HandlerPriority = HandlerPriority.NORMAL
    ): () -> Unit {
        // Remove any existing handler with the same id
        listeners.removeAll { it.id == id }

        // Add the new handler
        listeners.add(HandlerRegistration(id, priority.value, handler))

        // Sort by descending priority
        listeners.sortByDescending { it.priority }

        // Return the unregister function
        return {
            listeners.removeAll { it.id == id }
        }
    }

    override fun selectionChanged(event: SelectionEvent) {
        if (event.editor.isDisposed || event.editor.project?.isDisposed == true) {
            return
        }

        coroutineScope.launch {
            handleSelectionChange(event)
        }
    }

    /**
     * Handle a given selection change event.
     * @param e The selection change event.
     */
    private suspend fun handleSelectionChange(e: SelectionEvent) {
        val now = System.currentTimeMillis()

        // Simple debouncing logic
        // Ignore events that come too quickly after the previous one
        if (now - lastEventTime < DEBOUNCE_DELAY) {
            // Replace the queued event with the most recent one
            if (eventQueue.isNotEmpty()) {
                eventQueue.clear()
            }
            eventQueue.offer(e)
            return
        }

        lastEventTime = now

        // Queue this event for later if the manager is already processing an event
        if (isProcessingEvent) {
            eventQueue.offer(e)
            return
        }

        try {
            // Process this event first
            processEventWithTimeout(e)

            // Process remaining queued events sequentially
            while (eventQueue.isNotEmpty()) {
                val nextEvent = eventQueue.poll()
                if (nextEvent != null) {
                    processEventWithTimeout(nextEvent)
                }
            }
        } catch (err: Exception) {
            println("Error processing selection change event: ${err.message}")
            err.printStackTrace()
        }
    }

    /**
     * Process a given event with a timeout.
     * This is in attempt to prevent deadlocks between events.
     * @param e The selection change event.
     */
    private suspend fun processEventWithTimeout(e: SelectionEvent) {
        processingMutex.withLock {
            isProcessingEvent = true

            try {
                // Cancel any existing processing job
                processingJob?.cancel()

                // Set up a timeout to prevent deadlocks
                processingJob = coroutineScope.launch {
                    try {
                        processEvent(e)
                    } catch (ex: Exception) {
                        println("Error in processEvent: ${ex.message}")
                        ex.printStackTrace()
                    }
                }

                // Wait for completion with timeout
                val timeoutJob = coroutineScope.launch {
                    delay(PROCESSING_TIMEOUT)
                    processingJob?.cancel()
                    throw Exception("Selection change event processing timed out")
                }

                try {
                    processingJob?.join()
                    timeoutJob.cancel()
                } catch (ex: Exception) {
                    println("Processing timeout or error: ${ex.message}")
                }

            } finally {
                isProcessingEvent = false
                processingJob = null
            }
        }
    }

    /**
     * Core event processing logic.
     * @param e The selection change event.
     */
    private suspend fun processEvent(e: SelectionEvent) {
        val snapshot = captureState(e)

        for (registration in listeners) {
            try {
                if (registration.handler(e, snapshot)) {
                    return
                }
            } catch (err: Exception) {
                println("Error in selection change handler '${registration.id}': ${err.message}")
                err.printStackTrace()
                // Don't break - continue to next handler
            }
        }
    }

    private fun captureState(e: SelectionEvent): StateSnapshot {
        val nextEditWindowManager = runCatching {
            project.getService(NextEditWindowManager::class.java)
        }.getOrNull()

        val jumpManager = runCatching {
            project.getService(NextEditJumpManager::class.java)
        }.getOrNull()

        val cursorPosition = try {
            e.editor.caretModel.primaryCaret.logicalPosition
        } catch (ex: Exception) {
            null
        }

        return StateSnapshot(
            nextEditWindowAccepted = nextEditWindowManager?.hasAccepted() ?: false,
            jumpInProgress = jumpManager?.isJumpInProgress() ?: false,
            jumpJustAccepted = jumpManager?.wasJumpJustAccepted() ?: false,
            lastDocumentChangeTime = lastDocumentChangeTime,
            isTypingSession = isTypingSession,
            document = e.editor.document,
            cursorPosition = cursorPosition
        )
    }

    private suspend fun defaultFallbackHandler(
        e: SelectionEvent,
        state: StateSnapshot
    ): Boolean {
        println("defaultFallbackHandler: deleteChain called from selectionChanged")

        try {
            val nextEditService = project.getService(NextEditService::class.java)
            nextEditService.deleteChain()
        } catch (ex: Exception) {
            println("Error deleting chain in defaultFallbackHandler: ${ex.message}")
        }

        // TODO: Add prefetch logic similar to VS Code if needed
        // This would involve getting next editable regions and enqueuing them

        return true
    }
}