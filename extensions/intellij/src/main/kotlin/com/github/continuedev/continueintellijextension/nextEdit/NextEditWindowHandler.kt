package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.listeners.CursorMovementHandler
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.project.Project

/**
 * Handler for cursor movements during next edit window operations.
 */
class NextEditWindowHandler(
    private val project: Project,
    private val windowManager: NextEditWindowManager,
    private val expectedPosition: LogicalPosition
) : CursorMovementHandler {

    override val handlerId = "nextEditWindow"

    override suspend fun onCursorMoved(
        editor: Editor,
        oldPosition: LogicalPosition?,
        newPosition: LogicalPosition
    ): Boolean {
        // Check if window was just accepted
        if (windowManager.hasAccepted()) {
            return true
        }

        // Check if cursor is still near the expected position (within the same line)
        if (newPosition.line == expectedPosition.line) {
            return true
        }

        // User moved away from the suggestion area - close window and treat as deliberate
        windowManager.hideAllNextEditWindows()
        return false
    }

    override fun onDeactivated() {
        println("NextEditWindowHandler: Deactivated")
    }

    override fun dispose() {
        onDeactivated()
    }
}