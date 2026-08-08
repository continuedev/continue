package com.github.continuedev.continueintellijextension.listeners

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.project.Project

/**
 * Handler for cursor movements during typing sessions.
 * Preserves the chain when user is actively typing.
 */
class TypingSessionHandler(
    private val project: Project
) : CursorMovementHandler {

    override val handlerId = "typingSession"

    private var lastDocumentChangeTime = 0L
    private val TYPING_DELAY = 1000L // ms - consider movements within this time as typing

    fun updateTypingTime() {
        lastDocumentChangeTime = System.currentTimeMillis()
    }

    override suspend fun onCursorMoved(
        editor: Editor,
        oldPosition: LogicalPosition?,
        newPosition: LogicalPosition
    ): Boolean {
        val now = System.currentTimeMillis()
        val timeSinceLastEdit = now - lastDocumentChangeTime

        // If recent document change and cursor moved forward/down, likely typing
        if (timeSinceLastEdit < TYPING_DELAY) {
            val isTypingMovement = oldPosition?.let { old ->
                // Same line, moving forward
                (newPosition.line == old.line && newPosition.column > old.column) ||
                        // Next line, typical of pressing Enter
                        (newPosition.line == old.line + 1 && newPosition.column <= old.column)
            } ?: false

            if (isTypingMovement) {
                return true
            }
        }

        return false
    }

    override fun onDeactivated() {
        //println("TypingSessionHandler: Deactivated")
    }

    override fun dispose() {
        onDeactivated()
    }
}