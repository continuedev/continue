package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.ToolWindowManager

fun getContinuePluginService(project: Project?): ContinuePluginService? {
    if (project != null) {
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow = toolWindowManager.getToolWindow("Continue")

        if (toolWindow != null) {
            if (!toolWindow.isVisible) {
                toolWindow.activate(null)
            }
        }
    }

    return getPluginService(project)
}

fun focusContinueInput(project: Project?) {
    val continuePluginService = getContinuePluginService(project) ?: return
    continuePluginService.continuePluginWindow?.content?.components?.get(0)?.requestFocus()
    continuePluginService.sendToWebview("focusContinueInputWithoutClear", null)

    continuePluginService.ideProtocolClient?.sendHighlightedCode()
}

fun getPluginService(project: Project?): ContinuePluginService? =
    project?.service<ContinuePluginService>()

fun AnActionEvent.getFiles(): Array<out VirtualFile> {
    val multipleFiles = this.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY)
    if (multipleFiles != null) {
        return multipleFiles
    }

    return this.getData(CommonDataKeys.VIRTUAL_FILE)?.let { arrayOf(it) } ?: emptyArray()
}
