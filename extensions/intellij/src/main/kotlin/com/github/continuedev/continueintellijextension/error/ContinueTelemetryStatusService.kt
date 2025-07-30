package com.github.continuedev.continueintellijextension.error

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.ProjectManager
import kotlinx.coroutines.*
import kotlin.time.Duration.Companion.seconds

@Service
class ContinueTelemetryStatusService : ContinueTelemetryStatus {
    private val project get() = ProjectManager.getInstance().defaultProject // todo: hack? verify
    private val scope = CoroutineScope(Dispatchers.Default)

    @Volatile
    override var allowAnonymousTelemetry: Boolean = DISABLED_FALLBACK
        private set

    init {
        scope.launch {
            while (isActive) {
                poolTelemetryStatus()
                delay(10.seconds)
            }
        }
    }

    private fun poolTelemetryStatus() {
        val coreMessenger = project.service<ContinuePluginService>().coreMessenger
            ?: return
        coreMessenger.request("config/getSerializedProfileInfo", null, null) { response ->
            allowAnonymousTelemetry =
                response.castNestedOrNull<Boolean>("content", "result", "config", "allowAnonymousTelemetry")
                    ?: DISABLED_FALLBACK
        }
    }

    private companion object {
        const val DISABLED_FALLBACK = false
    }
}