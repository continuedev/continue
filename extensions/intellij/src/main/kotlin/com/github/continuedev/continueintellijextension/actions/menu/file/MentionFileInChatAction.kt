package com.github.continuedev.continueintellijextension.actions.menu.file

import com.github.continuedev.continueintellijextension.actions.getContinuePluginService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.vfs.VirtualFile

class MentionFileInChatAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return
        val virtualFile = e.getFile() ?: return

        val params = mapOf(
            "fullFilePath" to virtualFile.url,
            "shortFilePath" to virtualFile.name,
        )

        continuePluginService.sendToWebview("mentionFile", params)
    }

    override fun update(e: AnActionEvent) {
        val file = e.getFile()
        val files = e.getFiles()

        val isAvailable = file != null && !file.isDirectory && files.size == 1

        e.presentation.isVisible = isAvailable
    }

    private fun AnActionEvent.getFile(): VirtualFile? {
        return this.getData(CommonDataKeys.VIRTUAL_FILE)
    }

    private fun AnActionEvent.getFiles(): Array<out VirtualFile> {
        return this.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY).orEmpty()
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
