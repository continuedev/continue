package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.HighlightedCodePayload
import com.github.continuedev.continueintellijextension.RangeInFileWithContents
import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.github.continuedev.continueintellijextension.editor.EditorUtils
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import java.io.File

class RestartContinueProcess : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<ContinuePluginService>()?.coreMessenger?.restart()
    }
}

class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        acceptHorizontalDiff(e)
        acceptVerticalDiff(e)
    }

    private fun acceptHorizontalDiff(e: AnActionEvent) {
        val continuePluginService = e.project?.service<ContinuePluginService>() ?: return
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
        e.project?.service<ContinuePluginService>()?.diffManager?.rejectDiff(null)
    }

    private fun rejectVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.reject(editor)
    }
}

class FocusContinueInputWithoutClearAction : ContinueToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("focusContinueInputWithoutClear")
        project.getBrowser()?.focusOnInput()
    }
}

class FocusContinueInputAction : ContinueToolbarAction() {
    override fun toolbarActionPerformed(project: Project) =
        focusContinueInput(project)

    companion object {
        fun focusContinueInput(project: Project?) {
            val browser = project?.getBrowser()
                ?: return
            browser.sendToWebview("focusContinueInputWithNewSession")
            browser.focusOnInput()
            val rif = EditorUtils.getEditor(project)?.getHighlightedRIF()
                ?: return
            val code = HighlightedCodePayload(RangeInFileWithContents(rif.filepath, rif.range, rif.contents))
            browser.sendToWebview("highlightedCode", code)
        }
    }
}

class NewContinueSessionAction : ContinueToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("focusContinueInputWithNewSession")
    }
}

class ViewHistoryAction : ContinueToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("navigateTo", mapOf("path" to "/history", "toggle" to true))
    }
}

class OpenConfigAction : ContinueToolbarAction() {
    override fun toolbarActionPerformed(project: Project)  {
        project.getBrowser()?.sendToWebview("navigateTo", mapOf("path" to "/config", "toggle" to true))
    }
}

class OpenLogsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val logFile = File(System.getProperty("user.home") + "/.continue/logs/core.log")
        if (logFile.exists()) {
            val virtualFile = com.intellij.openapi.vfs.LocalFileSystem.getInstance().findFileByIoFile(logFile)
            if (virtualFile != null) {
                FileEditorManager.getInstance(project).openFile(virtualFile, true)
            }
        }
    }
}



