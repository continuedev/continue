package com.github.yutoagentic.yutoagenticintellijextension.error

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Attachment
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.util.SystemInfo
import com.intellij.ui.jcef.JBCefApp
import io.sentry.Hint
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.protocol.Message

private typealias SentryAttachment = io.sentry.Attachment

@Service
class ContinueSentryService(
    private val telemetryStatus: ContinueTelemetryStatus = service<ContinueTelemetryStatusService>()
) {
    private val log = Logger.getInstance(ContinueSentryService::class.java.simpleName)

    init {
        if (SENTRY_DSN.isNotEmpty()) {
            Sentry.init { config ->
                config.dsn = SENTRY_DSN
                config.environment = recognizeEnvironment()
                config.isSendDefaultPii = false
                config.setTag("ide_version", ApplicationInfo.getInstance().build.asString())
                config.setTag("jcef_supported", JBCefApp.isSupported().toString())
                config.setTag("plugin_version", PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))?.version)
                config.setTag("system", SystemInfo.OS_NAME)
                config.setTag("system_version", SystemInfo.OS_VERSION)
            }
        }
    }

    fun report(
        throwable: Throwable,
        message: String? = null,
        attachments: List<Attachment>? = null,
        ignoreTelemetrySettings: Boolean = false
    ) {
        if (!ignoreTelemetrySettings && !telemetryStatus.allowAnonymousTelemetry) {
            log.warn("Sentry report was ignored because telemetry is disabled", throwable)
            return
        }
        val sentryEvent = SentryEvent()
        sentryEvent.throwable = throwable
        sentryEvent.message = Message().apply { this.message = message }
        val hint = Hint.withAttachments(attachments?.map { SentryAttachment(it.bytes, it.path) })
        Sentry.captureEvent(sentryEvent, hint)
        log.warn("Exception sent to Sentry", throwable)
    }

    fun reportMessage(
        message: String,
    ) {
        if (!telemetryStatus.allowAnonymousTelemetry) {
            log.warn("Sentry message report was ignored because telemetry is disabled: $message")
            return
        }
        Sentry.captureMessage(message)
        log.warn("Message sent to Sentry: $message")
    }

    private companion object {
        private const val PLUGIN_ID = "com.github.yutoagentic.yutoagenticintellijextension"

        // Sentry DSN is read from env at startup. Empty string disables reporting.
        private val SENTRY_DSN: String = System.getenv("YUTOAGENTIC_SENTRY_DSN").orEmpty()

        private fun recognizeEnvironment() =
            when {
                System.getProperty("robot-server.port") != null -> "e2e"
                System.getProperty("idea.is.internal").toBoolean() -> "dev"
                else -> "production"
            }
    }
}