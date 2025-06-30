package com.github.continuedev.continueintellijextension.error

import com.intellij.diagnostic.IdeaReportingEvent
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.diagnostic.ErrorReportSubmitter
import com.intellij.openapi.diagnostic.IdeaLoggingEvent
import com.intellij.openapi.diagnostic.SubmittedReportInfo
import com.intellij.openapi.diagnostic.SubmittedReportInfo.SubmissionStatus
import com.intellij.ui.jcef.JBCefApp
import com.intellij.util.Consumer
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.protocol.Message
import java.awt.Component

class ContinueErrorSubmitter : ErrorReportSubmitter() {

    init {
        Sentry.init { config ->
            config.dsn = SENTRY_DSN
            config.isSendDefaultPii = false
            config.setTag("ide_version", ApplicationInfo.getInstance().build.asString())
            config.setTag("jcef_supported", JBCefApp.isSupported().toString())
        }
    }

    override fun getReportActionText() =
        "Report to Continue"

    override fun submit(
        events: Array<out IdeaLoggingEvent?>,
        additionalInfo: String?,
        parentComponent: Component,
        consumer: Consumer<in SubmittedReportInfo>
    ): Boolean {
        try {
            val event = events.filterIsInstance<IdeaReportingEvent>().firstOrNull() ?: return false
            val sentryEvent = SentryEvent()
            sentryEvent.throwable = event.data.throwable
            sentryEvent.message = Message().apply { message = additionalInfo }
            sentryEvent.setTag("plugin_version", event.plugin?.version)
            Sentry.captureEvent(sentryEvent)
        } catch (_: Exception) {
            consumer.consume(SubmittedReportInfo(SubmissionStatus.FAILED))
            return false
        }
        consumer.consume(SubmittedReportInfo(SubmissionStatus.NEW_ISSUE))
        return true
    }

    private companion object {
        private const val SENTRY_DSN = "https://fe99934dcdc537d84209893a3f96a196@o4505462064283648.ingest.us.sentry.io/4508184596054016"
    }

}
