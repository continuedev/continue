package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class AddToChatAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val browser = e.project?.getBrowser() ?: return
        val selectedFiles = e.getSelectedFiles()

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

        browser.sendToWebview("addToChat", requestParams)
    }

    override fun update(e: AnActionEvent) {
        val files = e.getSelectedFiles()

        val isAvailable = files.isNotEmpty()

        e.presentation.isVisible = isAvailable
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
