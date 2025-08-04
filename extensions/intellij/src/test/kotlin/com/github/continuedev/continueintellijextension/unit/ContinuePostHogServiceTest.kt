package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.error.ContinuePostHogService
import com.github.continuedev.continueintellijextension.error.ContinueTelemetryStatus
import com.posthog.java.PostHog
import io.mockk.mockk
import io.mockk.verify
import junit.framework.TestCase

class ContinuePostHogServiceTest : TestCase() {

    fun `test report when telemetry is enabled`() {
        val postHog = mockk<PostHog>(relaxed = true)
        val service = ContinuePostHogService(TestTelemetryService(true), postHog)
        service.capture("test", mapOf("test" to "test"))
        verify { postHog.capture(any(), any(), any()) }
    }

    fun `test don't report when telemetry is disabled`() {
        val postHog = mockk<PostHog>(relaxed = true)
        val service = ContinuePostHogService(TestTelemetryService(false), postHog)
        service.capture("test", mapOf("test" to "test"))
        verify(exactly = 0) { postHog.capture(any(), any(), any()) }
    }

    private class TestTelemetryService(
        override val allowAnonymousTelemetry: Boolean
    ) : ContinueTelemetryStatus
}