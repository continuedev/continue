package com.github.continuedev.continueintellijextension.editor

import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project

fun closeInlineEdit(project: Project, editor: Editor) {
    try {
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.reject(editor)
    } catch (e: Exception) {
        println("Failed to close inline edit: ${e.message}")
    }
}

class CloseInlineEditAction : AnAction(), DumbAware {
    override fun actionPerformed(e: AnActionEvent) {
        if (isInvokedInEditor(e)) {
            val editor = e.getData(PlatformDataKeys.EDITOR) ?: return
            val project = e.getData(PlatformDataKeys.PROJECT) ?: return
            closeInlineEdit(project, editor)
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

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.EDT
    }
}