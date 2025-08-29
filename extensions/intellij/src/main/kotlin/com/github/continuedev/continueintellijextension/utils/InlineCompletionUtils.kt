package com.github.continuedev.continueintellijextension.utils

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.impl.SimpleDataContext
import com.intellij.openapi.application.EDT
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object InlineCompletionUtils {
    /**
     * Triggers inline completion for the given editor.
     * This is equivalent to pressing Shift+Alt+Backslash or calling the "Generate Inline Completion" action.
     * Always executes on the EDT to avoid threading issues.
     *
     * @param editor The editor to trigger completion for
     * @param project The project context (optional, will be inferred from editor if null)
     */
    suspend fun triggerInlineCompletion(
        editor: Editor,
        project: Project? = null
    ): Boolean = withContext(Dispatchers.EDT) {
        performTrigger(editor, project)
    }

    /**
     * Internal method that performs the actual trigger logic.
     * Must be called on the EDT.
     */
    private fun performTrigger(editor: Editor, project: Project?): Boolean {
        return try {
            val actionManager = ActionManager.getInstance()
            val action = actionManager.getAction("CallInlineCompletionAction")

            if (action != null) {
                println("Found CallInlineCompletionAction, checking if enabled...")

                val effectiveProject = project ?: editor.project
                val dataContext = SimpleDataContext.builder()
                    .add(CommonDataKeys.EDITOR, editor)
                    .add(CommonDataKeys.PROJECT, effectiveProject)
                    .build()

                val event = AnActionEvent.createFromDataContext(
                    "ProgrammaticInlineCompletion",
                    null,
                    dataContext
                )

                // Check if action is enabled before performing it
                action.update(event)
                val isEnabled = event.presentation.isEnabled
                println("Action enabled: $isEnabled")

                if (isEnabled) {
                    action.actionPerformed(event)
                    println("Action performed successfully")
                    true
                } else {
                    println("Action is disabled, not performing")
                    false
                }
            } else {
                println("CallInlineCompletionAction not found!")
                false
            }
        } catch (e: Exception) {
            println("Exception in performTrigger: ${e.message}")
            e.printStackTrace()
            false
        }
    }
}