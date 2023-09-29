package com.github.continuedev.continueintellijextension.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager


class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}

class RejectDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}

class QuickTextEntryAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}

class QuickFixAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}

class ViewLogsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}

class ToggleAuxiliaryBarAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow = toolWindowManager.getToolWindow("ContinuePluginViewer")

        if (toolWindow != null) {
            if (toolWindow.isVisible) {
                toolWindow.hide(null)
            } else {
                toolWindow.activate(null)
            }
        }
    }
}

class FocusContinueInputWithEditAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindowManager = ToolWindowManager.getInstance(project)
        toolWindowManager.getToolWindow("ContinuePluginViewer")?.activate(null)
    }
}

class FocusContinueInputAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindowManager = ToolWindowManager.getInstance(project)
        toolWindowManager.getToolWindow("ContinuePluginViewer")?.activate(null)

//        val project: Project = event.getProject()
//        val editor: Editor = event.getDataContext().getData(EditorDataKeys.EDITOR)
//        val selectionModel: SelectionModel = editor.getSelectionModel()
//        val selectedText = selectionModel.selectedText
    }
}

class DebugTerminalAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        Messages.showMessageDialog(
            "This action is not yet implemented",
            "Continue Action not Implemented",
            Messages.getInformationIcon()
        )
    }
}