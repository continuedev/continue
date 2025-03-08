package com.github.continuedev.continueintellijextension.services

import com.intellij.openapi.components.Service
import com.posthog.java.PostHog
import com.posthog.java.PostHog.Builder

@Service
class TelemetryService {
    private val POSTHOG_API_KEY = "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs"
    private var posthog: PostHog? = null;
    private var distinctId: String? = null;
    
    fun setup(distinctId: String) {
        this.posthog = Builder(POSTHOG_API_KEY).host("https://app.posthog.com").build()
        this.distinctId = distinctId
    }

    fun capture(eventName: String, properties: Map<String, *>) {
        if (this.posthog == null || this.distinctId == null) {
            return;
        }
        try {
            this.posthog?.capture(this.distinctId, eventName, properties)
        } catch (e: Exception) {}
    }

    fun shutdown() {
        this.posthog?.shutdown()
    }
}