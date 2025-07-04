package com.github.continuedev.continueintellijextension.error

import com.intellij.diagnostic.IdeaReportingEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.ErrorReportSubmitter
import com.intellij.openapi.diagnostic.IdeaLoggingEvent
import com.intellij.openapi.diagnostic.SubmittedReportInfo
import com.intellij.openapi.diagnostic.SubmittedReportInfo.SubmissionStatus
import com.intellij.util.Consumer
import java.awt.Component

class ContinueErrorSubmitter : ErrorReportSubmitter() {

    override fun getReportActionText() =
        "Report to Continue"

    override fun submit(
        events: Array<out IdeaLoggingEvent?>,
        additionalInfo: String?,
        parentComponent: Component,
        consumer: Consumer<in SubmittedReportInfo>
    ): Boolean {
        try {
            val event = events.filterIsInstance<IdeaReportingEvent>()
                .firstOrNull() ?: return false
            service<ContinueErrorService>().report(
                throwable = event.data.throwable,
                message = additionalInfo ?: event.data.message,
                attachments = event.data.allAttachments
            )
        } catch (_: Exception) {
            consumer.consume(SubmittedReportInfo(SubmissionStatus.FAILED))
            return false
        }
        consumer.consume(SubmittedReportInfo(SubmissionStatus.NEW_ISSUE))
        return true
    }

}
