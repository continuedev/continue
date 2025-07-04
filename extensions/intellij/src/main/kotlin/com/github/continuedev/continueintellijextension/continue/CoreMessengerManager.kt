package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.TelemetryService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class CoreMessengerManager(
    private val project: Project,
    private val ideProtocolClient: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) {

    var coreMessenger: CoreMessenger? = null
    private var lastBackoffInterval = 0.5

    init {
        coroutineScope.launch {
            setupCoreMessenger()
        }
    }

    private fun setupCoreMessenger() {
        try {
            coreMessenger = CoreMessenger(project, ideProtocolClient, coroutineScope, onExit = {
                lastBackoffInterval *= 2
                println("CoreMessenger exited, retrying in $lastBackoffInterval seconds")
                Thread.sleep((lastBackoffInterval * 1000).toLong())
                setupCoreMessenger()
            })

            coreMessenger?.request("config/getSerializedProfileInfo", null, null) { response ->
                val allowAnonymousTelemetry =
                    response.castNestedOrNull<Boolean>("content", "result", "config", "allowAnonymousTelemetry")

                val telemetryService = service<TelemetryService>()
                if (allowAnonymousTelemetry == true || allowAnonymousTelemetry == null) {
                    telemetryService.setup(getMachineUniqueID())
                }
            }
        } catch (err: Throwable) {
            val telemetryService = service<TelemetryService>()
            telemetryService.capture("jetbrains_core_start_error", mapOf("error" to err))

            err.printStackTrace()
        }
    }
}
