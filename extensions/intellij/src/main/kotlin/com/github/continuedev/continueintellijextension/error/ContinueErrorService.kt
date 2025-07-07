package com.github.continuedev.continueintellijextension.error

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Attachment
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.extensions.PluginId
import com.intellij.ui.jcef.JBCefApp
import io.sentry.Hint
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.protocol.Message

private typealias SentryAttachment = io.sentry.Attachment

@Service
class ContinueErrorService {
    private val log = Logger.getInstance(ContinueErrorService::class.java)

    init {
        Sentry.init { config ->
            config.dsn = SENTRY_DSN
            config.environment = recognizeEnvironment()
            config.isSendDefaultPii = false
            config.setTag("ide_version", ApplicationInfo.getInstance().build.asString())
            config.setTag("jcef_supported", JBCefApp.isSupported().toString())
            config.setTag("plugin_version", PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))?.version)
        }
    }

    fun report(
        throwable: Throwable,
        message: String? = null,
        attachments: List<Attachment>? = null
    ) {
        val sentryEvent = SentryEvent()
        sentryEvent.throwable = throwable
        sentryEvent.message = Message().apply { this.message = message }
        val hint = Hint.withAttachments(attachments?.map { SentryAttachment(it.bytes, it.path) })
        Sentry.captureEvent(sentryEvent, hint)
        log.warn("Problem sent to Sentry: $message", throwable)
    }

    private companion object {
        private const val PLUGIN_ID = "com.github.continuedev.continueintellijextension"
        private const val SENTRY_DSN =
            "https://fe99934dcdc537d84209893a3f96a196@o4505462064283648.ingest.us.sentry.io/4508184596054016"

        private fun recognizeEnvironment() =
            when {
                System.getProperty("robot-server.port") != null -> "e2e"
                System.getProperty("idea.is.internal").toBoolean() -> "dev"
                else -> "production"
            }
    }
}