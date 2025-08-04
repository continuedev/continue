package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager

class RestartContinueProcess : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val pluginService = getContinuePluginService(e.project) ?: return
        pluginService.coreMessengerManager?.coreMessenger?.restart()
    }
}

class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        acceptHorizontalDiff(e)
        acceptVerticalDiff(e)
    }

    private fun acceptHorizontalDiff(e: AnActionEvent) {
        val continuePluginService = getPluginService(e.project) ?: return
        continuePluginService.diffManager?.acceptDiff(null)
    }

    private fun acceptVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.accept(editor)
    }
}

class RejectDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        rejectHorizontalDiff(e)
        rejectVerticalDiff(e)
    }

    private fun rejectHorizontalDiff(e: AnActionEvent) {
        val continuePluginService = getPluginService(e.project) ?: return
        continuePluginService.diffManager?.rejectDiff(null)
    }

    private fun rejectVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.reject(editor)
    }
}


class FocusContinueInputWithoutClearAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        focusContinueInput(project)
    }
}

class FocusContinueInputAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return

        continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
        continuePluginService.sendToWebview("focusContinueInputWithNewSession", null)

        continuePluginService.ideProtocolClient?.sendHighlightedCode()
    }
}

class NewContinueSessionAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return
        continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
        continuePluginService.sendToWebview("focusContinueInputWithNewSession", null)
    }
}

class ViewHistoryAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return
        val params = mapOf("path" to "/history", "toggle" to true)
        continuePluginService.sendToWebview("navigateTo", params)
    }
}

class OpenConfigAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return
        continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
        val params = mapOf("path" to "/config", "toggle" to true)
        continuePluginService.sendToWebview("navigateTo", params)
    }
}

class OpenLogsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val logFile = java.io.File(System.getProperty("user.home") + "/.continue/logs/core.log")
        if (logFile.exists()) {
            val virtualFile = com.intellij.openapi.vfs.LocalFileSystem.getInstance().findFileByIoFile(logFile)
            if (virtualFile != null) {
                FileEditorManager.getInstance(project).openFile(virtualFile, true)
            }
        }
    }
}



