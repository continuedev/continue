package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.TelemetryService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.github.continuedev.continueintellijextension.utils.getContinueBinaryPath
import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*

class CoreMessengerManager(
    private val project: Project,
    private val ideProtocolClient: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) {

    var coreMessenger: CoreMessenger? = null
    private var lastBackoffInterval = 0.5

    init {
        coroutineScope.launch {
            val continueBinaryPath = getContinueBinaryPath()
            setupCoreMessenger(continueBinaryPath)
        }
    }

    private fun setupCoreMessenger(continueCorePath: String) {
        try {
            coreMessenger = CoreMessenger(project, continueCorePath, ideProtocolClient, coroutineScope)

        coreMessenger?.request("config/getSerializedProfileInfo", null, null) { response ->
            val allowAnonymousTelemetry = response.castNestedOrNull<Boolean>("content", "result", "config", "allowAnonymousTelemetry")

            val telemetryService = service<TelemetryService>()
            if (allowAnonymousTelemetry == true || allowAnonymousTelemetry == null) {
                telemetryService.setup(getMachineUniqueID())
            }
        }

            // On exit, use exponential backoff to create another CoreMessenger
            coreMessenger?.onDidExit {
                lastBackoffInterval *= 2
                println("CoreMessenger exited, retrying in $lastBackoffInterval seconds")
                Thread.sleep((lastBackoffInterval * 1000).toLong())
                setupCoreMessenger(continueCorePath)
            }
        } catch (err: Throwable) {
            val telemetryService = service<TelemetryService>()
            telemetryService.capture("jetbrains_core_start_error", mapOf("error" to err))

            err.printStackTrace()
        }
    }
}
