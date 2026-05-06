package com.github.yutoagentic.yutoagenticintellijextension.error

import com.github.yutoagentic.yutoagenticintellijextension.utils.getMachineUniqueID
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.posthog.java.PostHog

@Service
class ContinuePostHogService(
    private val telemetryStatus: ContinueTelemetryStatus = service<ContinueTelemetryStatusService>(),
    private val posthog: PostHog? = buildPostHogClient()
) {
    private val log = Logger.getInstance(ContinuePostHogService::class.java)
    private val distinctId: String = getMachineUniqueID()

    fun capture(eventName: String, properties: Map<String, *>) {
        if (!telemetryStatus.allowAnonymousTelemetry) {
            log.warn("PostHog capture was ignored because telemetry is disabled")
            return
        }
        val client = posthog ?: return
        try {
            client.capture(distinctId, eventName, properties)
            log.warn("Telemetry sent to PostHog: $eventName")
        } catch (_: Exception) {
        }
    }

    private companion object {
        // Telemetry endpoints are configurable. Default values keep this fork
        // running fully offline.
        private fun buildPostHogClient(): PostHog? {
            val apiKey = System.getenv("YUTOAGENTIC_POSTHOG_KEY").orEmpty()
            if (apiKey.isEmpty()) return null
            val host = System.getenv("YUTOAGENTIC_POSTHOG_HOST")?.takeIf { it.isNotEmpty() }
                ?: "https://app.posthog.com"
            return PostHog.Builder(apiKey).host(host).build()
        }
    }
}