package com.github.continuedev.continueintellijextension.actions.menu.file

import com.github.continuedev.continueintellijextension.actions.getContinuePluginService
import com.github.continuedev.continueintellijextension.actions.getFiles
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class AddFilesOrFoldersToChatAction : AnAction() {
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

        continuePluginService.sendToWebview("addChatMention", requestParams)
    }

    override fun update(e: AnActionEvent) {
        val files = e.getFiles()

        val isAvailable = files.isNotEmpty()

        e.presentation.isVisible = isAvailable
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
