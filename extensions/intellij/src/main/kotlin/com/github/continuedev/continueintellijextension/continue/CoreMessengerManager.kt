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

class CoreMessengerManager(
    private val project: Project,
    private val ideProtocolClient: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) {
    var coreMessenger: CoreMessenger = createCoreMessenger()
    private var lastBackoffInterval = 0.5
    private val log = Logger.getInstance(CoreMessengerManager::class.java)

    init {
        setupAnonymousTelemetry()
    }

    fun restart() {
        coroutineScope.launch {
            try {
                coreMessenger.killSubProcess()
                lastBackoffInterval *= 2
                log.warn("Continue process exited, retrying in $lastBackoffInterval seconds")
                delay((lastBackoffInterval * 1000).toLong())
                coreMessenger = createCoreMessenger()
            } catch (e: Exception) {
                service<TelemetryService>().capture("jetbrains_core_start_error", mapOf("error" to e))
            }
        }
    }

    private fun createCoreMessenger() =
        CoreMessenger(project, ideProtocolClient, coroutineScope, ::restart)

    private fun setupAnonymousTelemetry() {
        coreMessenger.request("config/getSerializedProfileInfo", null, null) { response ->
            val allowAnonymousTelemetry =
                response.castNestedOrNull<Boolean>("content", "result", "config", "allowAnonymousTelemetry")
            if (allowAnonymousTelemetry == true || allowAnonymousTelemetry == null)
                service<TelemetryService>().setup(getMachineUniqueID())
        }
    }
}
