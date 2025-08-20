package com.github.continuedev.continueintellijextension.actions.menu.file

import com.github.continuedev.continueintellijextension.actions.getContinuePluginService
import com.github.continuedev.continueintellijextension.actions.getSelectedFiles
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class AddRepoMapToChatAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continuePluginService = getContinuePluginService(e.project) ?: return
        val selectedFiles = e.getSelectedFiles()

        val requestData = selectedFiles.map { vFile ->
            mapOf(
                "type" to "repo-map",
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
        val files = e.getSelectedFiles()

        // only directories can be used
        val isAvailable = files.isNotEmpty() && files.all { file -> file.isDirectory }

        e.presentation.isVisible = isAvailable
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
