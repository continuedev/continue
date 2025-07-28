package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.TelemetryService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
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

    init {
        setupAnonymousTelemetry()
    }

    private fun onUnexpectedExit() {
        coroutineScope.launch {
            try {
                delay(backoffIntervalSeconds.seconds)
                backoffIntervalSeconds *= 2
                log.warn("Continue process terminated externally, retrying in $backoffIntervalSeconds seconds")
                coreMessenger.restart()
            } catch (e: Exception) {
                service<TelemetryService>().capture("jetbrains_core_start_error", mapOf("error" to e))
            }
        }
    }

    private fun setupAnonymousTelemetry() {
        coreMessenger.request("config/getSerializedProfileInfo", null, null) { response ->
            val allowAnonymousTelemetry =
                response.castNestedOrNull<Boolean>("content", "result", "config", "allowAnonymousTelemetry")
            if (allowAnonymousTelemetry == true || allowAnonymousTelemetry == null)
                service<TelemetryService>().setup(getMachineUniqueID())
        }
    }
}
