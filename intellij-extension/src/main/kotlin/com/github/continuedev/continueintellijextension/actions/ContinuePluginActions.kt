package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

fun pluginServiceFromActionEvent(e: AnActionEvent): ContinuePluginService? {
    val project = e.project ?: return null
    return ServiceManager.getService(
            project,
            ContinuePluginService::class.java
    )
}

class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.ideProtocolClient?.diffManager?.acceptDiff(null)
    }
}

class RejectDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.ideProtocolClient?.diffManager?.rejectDiff(null)
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
        val project = e.project
        if (project != null) {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("ContinuePluginViewer")

            if (toolWindow != null) {
                if (!toolWindow.isVisible) {
                    toolWindow.activate(null)
                }
            }
        }

        val continuePluginService = pluginServiceFromActionEvent(e) ?: return
        continuePluginService.continuePluginWindow.content.components[0].requestFocus()
        continuePluginService.dispatchCustomEvent("message", mutableMapOf("type" to "focusContinueInputWithEdit"))

        continuePluginService.ideProtocolClient?.sendHighlightedCode()
    }
}

class FocusContinueInputAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        if (project != null) {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("ContinuePluginViewer")

            if (toolWindow != null) {
                if (!toolWindow.isVisible) {
                    toolWindow.activate(null)
                }
            }
        }

        val continuePluginService = pluginServiceFromActionEvent(e) ?: return

        continuePluginService.continuePluginWindow.content.components[0].requestFocus()
        continuePluginService.dispatchCustomEvent("message", mutableMapOf("type" to "focusContinueInput"))

        continuePluginService.ideProtocolClient?.sendHighlightedCode()
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