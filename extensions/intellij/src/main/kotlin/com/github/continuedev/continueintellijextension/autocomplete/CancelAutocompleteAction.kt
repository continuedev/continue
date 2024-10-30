package com.github.continuedev.continueintellijextension.autocomplete

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project

class CancelAutocompleteAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        if (isInvokedInEditor(e)) {
            val editor = e.getRequiredData(CommonDataKeys.EDITOR)
            ApplicationManager.getApplication().runWriteAction {
                editor.project?.service<AutocompleteService>()?.clearCompletions(editor)
            }
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = isInvokedInEditor(e)
    }

    private fun isInvokedInEditor(e: AnActionEvent): Boolean {
        val project: Project? = e.project
        val editor: Editor? = e.getData(CommonDataKeys.EDITOR)
        return project != null && editor != null && editor.contentComponent.hasFocus()
    }
}
