package com.github.continuedev.continueintellijextension.actions.menu.file

import com.github.continuedev.continueintellijextension.actions.getContinuePluginService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.vfs.VirtualFile

class MentionFilesOrFoldersInChatAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return
        val selectedFiles = e.getFiles()

        val requestData = selectedFiles.map { vFile ->
            val type = if (vFile.isDirectory) "folder" else "file"

            mapOf(
                "type" to type,
                "fullPath" to vFile.url,
                "name" to vFile.name,
            )
        }
        val requestParams = mapOf(
            "data" to requestData
        )

        continuePluginService.sendToWebview("mentionFilesOrDirectories", requestParams)
    }

    override fun update(e: AnActionEvent) {
        val files = e.getFiles()

        val isAvailable = files.isNotEmpty()

        e.presentation.isVisible = isAvailable
    }

    private fun AnActionEvent.getFiles(): Array<out VirtualFile> {
        val multipleFiles = this.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY)
        if (multipleFiles != null) {
            return multipleFiles
        }

        return this.getData(CommonDataKeys.VIRTUAL_FILE)?.let { arrayOf(it) } ?: emptyArray()
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
