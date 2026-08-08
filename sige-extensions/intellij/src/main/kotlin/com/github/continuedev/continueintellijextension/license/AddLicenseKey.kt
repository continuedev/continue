package com.github.continuedev.continueintellijextension.license

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper

class AddLicenseKey : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        performAddLicenseKey(e.project)
    }

    private fun performAddLicenseKey(project: Project?) {
        if (project == null)
            return
        val dialog = AddLicenseKeyDialog(project)
        dialog.show()
        if (dialog.exitCode != DialogWrapper.OK_EXIT_CODE)
            return
        val messenger = project.service<ContinuePluginService>().coreMessenger
            ?: return
        messenger.request("mdm/setLicenseKey", mapOf("licenseKey" to dialog.licenseKey), null) { response ->
            val isValid = response.castNestedOrNull<Boolean>("content") ?: false
            val notification = if (isValid)
                createSuccessAction()
            else
                createErrorAction()
            notification.notify(project)
        }
    }

    private fun createSuccessAction() =
        getContinueNotifications().createNotification(
            "License key is valid. A restart is required for it to take effect.",
            NotificationType.INFORMATION
        ).addAction(
            NotificationAction.create("Restart IDE") { _, _ ->
                ApplicationManager.getApplication().restart()
            }
        )

    private fun createErrorAction() =
        getContinueNotifications().createNotification(
            "License key is invalid.",
            NotificationType.ERROR
        ).addAction(
            NotificationAction.create("Try again") { event, notification ->
                notification.expire()
                performAddLicenseKey(event.project)
            }
        )

    private fun getContinueNotifications() =
        NotificationGroupManager.getInstance().getNotificationGroup("Continue")
}