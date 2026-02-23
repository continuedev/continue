package com.github.continuedev.continueintellijextension.error

import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.posthog.java.PostHog

@Service
class ContinuePostHogService(
    private val telemetryStatus: ContinueTelemetryStatus = service<ContinueTelemetryStatusService>(),
    private val posthog: PostHog = PostHog.Builder(POSTHOG_API_KEY).host("https://app.posthog.com").build()
) {
    private val log = Logger.getInstance(ContinuePostHogService::class.java)
    private val distinctId: String = getMachineUniqueID()

    fun capture(eventName: String, properties: Map<String, *>) {
        if (!telemetryStatus.allowAnonymousTelemetry) {
            log.warn("PostHog capture was ignored because telemetry is disabled")
            return
        }
        try {
            posthog.capture(distinctId, eventName, properties)
            log.warn("Telemetry sent to PostHog: $eventName")
        } catch (_: Exception) {
        }
    }

    private companion object {
        private const val POSTHOG_API_KEY = "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs"
    }
}