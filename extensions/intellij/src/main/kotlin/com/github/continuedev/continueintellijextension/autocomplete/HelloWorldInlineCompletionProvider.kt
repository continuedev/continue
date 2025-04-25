package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.codeInsight.inline.completion.*
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.WindowManager
import kotlin.collections.hashMapOf
import kotlin.collections.mapOf

/**
 * TODO:
 * - Make sure we can mark the completion as cancelled when it is rejected
 * - Will we be able to have a spinner widget?
 * - Do we need to do any kind of filtering specific to JetBrains?
 */
class HelloWorldInlineCompletionProvider : InlineCompletionProvider {
    override suspend fun getProposals(request: InlineCompletionRequest): List<InlineCompletionElement> {
        val project = request.editor.project ?: return emptyList()
        val completionId = uuid()
        val virtualFile = FileDocumentManager.getInstance().getFile(request.editor.document)

        val line = request.editor.document.getLineNumber(request.startOffset)
        val column = request.startOffset - request.editor.document.getLineStartOffset(line)

        val uri = virtualFile?.toUriOrNull() ?: return emptyList()
        val input = mapOf(
            "completionId" to completionId,
            "filepath" to uri,
            "pos" to mapOf(
                "line" to line,
                "character" to column
            ),
            "clipboardText" to "",
            "recentlyEditedRanges" to emptyList<Any>(),
            "recentlyVisitedRanges" to emptyList<Any>(),
        )

        // Use CompletableFuture approach
        val future = java.util.concurrent.CompletableFuture<List<InlineCompletionElement>>()

        project.service<ContinuePluginService>().coreMessenger?.request(
            "autocomplete/complete",
            input,
            null,
            { response ->
                val responseObject = response as Map<*, *>
                val completions = responseObject["content"] as List<*>

                if (completions.isNotEmpty()) {
                    val completion = completions[0].toString()
                    future.complete(listOf(InlineCompletionElement(completion)))
                } else {
                    future.complete(emptyList())
                }
            }
        ) ?: future.complete(emptyList())

        return future.get() // This will block until the future completes
    }

    override fun isEnabled(event: DocumentEvent): Boolean {
        val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
        return settings.continueState.enableTabAutocomplete
    }

    private val widget: AutocompleteSpinnerWidget? by lazy {
        null
//        WindowManager.getInstance().getStatusBar(project)
//            ?.getWidget(AutocompleteSpinnerWidget.ID) as? AutocompleteSpinnerWidget
    }

    private fun onSuggested() {
        widget?.setLoading(true)
    }

    private fun onCancel(project: Project) {
        widget?.setLoading(false)
        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/cancel", null, null, ({}))
    }

    private fun onAccept(project: Project) {
        val completionId = ""
        project.service<ContinuePluginService>().coreMessenger?.request(
            "autocomplete/accept",
            hashMapOf("completionId" to completionId),
            null,
            ({})
        )
    }
}