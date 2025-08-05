package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.error.ContinuePostHogService
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

class CoreMessengerManager(
    project: Project,
    ideProtocolClient: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) {
    val coreMessenger = CoreMessenger(project, ideProtocolClient, coroutineScope, ::onUnexpectedExit)
    private var backoffIntervalSeconds = 1
    private val log = Logger.getInstance(CoreMessengerManager::class.java)

    private fun onUnexpectedExit() {
        coroutineScope.launch {
            try {
                delay(backoffIntervalSeconds.seconds)
                backoffIntervalSeconds *= 2
                log.warn("Continue process terminated externally, retrying in $backoffIntervalSeconds seconds")
                coreMessenger.restart()
            } catch (e: Exception) {
                service<ContinuePostHogService>().capture("jetbrains_core_start_error", mapOf("error" to e))
            }
        }
    }
}
