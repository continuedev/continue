package com.github.continuedev.continueintellijextension.editor

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware

class ToggleInlineEditAction : AnAction(), DumbAware {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.getData(PlatformDataKeys.PROJECT) ?: return
        val editor = e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffService = project.service<DiffStreamService>()
        val handler = diffService.getHandler(editor)
        if (handler == null) {
            val actionId = "continue.inlineEdit"
            val action = ActionManager.getInstance().getAction(actionId)
            if (action != null) {
                e.actionManager.tryToExecute(action, e.inputEvent, null, null, true)
            }
        } else {
            handler.toggleFocus()
        }
    }
}