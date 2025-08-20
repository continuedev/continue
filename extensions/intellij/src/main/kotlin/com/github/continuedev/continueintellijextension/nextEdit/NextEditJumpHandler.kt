package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.listeners.CursorMovementHandler
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.project.Project

/**
 * Handler for cursor movements during jump operations.
 */
class NextEditJumpHandler(
    private val project: Project,
    private val jumpManager: NextEditJumpManager
) : CursorMovementHandler {

    override val handlerId = "nextEditJump"

    override suspend fun onCursorMoved(
        editor: Editor,
        oldPosition: LogicalPosition?,
        newPosition: LogicalPosition
    ): Boolean {
        // Check if we're still in a jump operation
        if (!jumpManager.isJumpInProgress()) {
            // Jump is no longer in progress, cursor movement is deliberate
            return false
        }

        val jumpPosition = jumpManager.getJumpPosition()
        val originalPosition = jumpManager.getOriginalPosition()

        return when {
            // Cursor moved to the expected jump position - this is expected
            jumpPosition != null && newPosition == jumpPosition -> {
                true
            }

            // Cursor is still at the original position - no movement yet
            originalPosition != null && newPosition == originalPosition -> {
                true
            }

            // Cursor moved somewhere else - user moved manually, abort jump
            else -> {
                jumpManager.abortJump()
                false
            }
        }
    }

    override fun onDeactivated() {
        println("NextEditJumpHandler: Deactivated")
    }

    override fun dispose() {
        onDeactivated()
    }
}