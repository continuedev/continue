package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.codeInsight.inline.completion.*
import com.intellij.codeInsight.inline.completion.elements.InlineCompletionElement
import com.intellij.codeInsight.inline.completion.elements.InlineCompletionGrayTextElement
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionSingleSuggestion
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionSuggestion
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.flow.flowOf

class ContinueInlineCompletionProvider : InlineCompletionProvider {
    override val id get() = InlineCompletionProviderID("Continue")
    override val insertHandler: InlineCompletionInsertHandler = NotifyingHandler()
    private var lastUuid: String? = null
    private var lastProject: Project? = null

    override fun isEnabled(event: InlineCompletionEvent): Boolean {
        val isSettingEnabled = ContinueExtensionSettings.instance.continueState.enableTabAutocomplete
        val isEventOk = event is InlineCompletionEvent.DirectCall
                || event is InlineCompletionEvent.DocumentChange
                || event is InlineCompletionEvent.LookupChange
        return isSettingEnabled && isEventOk
    }

    override suspend fun getSuggestion(request: InlineCompletionRequest): InlineCompletionSuggestion {
        val editor = request.editor
        val project = request.file.project
        lastUuid = uuid()
        lastProject = project
        val variant = project.service<CompletionService>().getAutocomplete(
            lastUuid!!,
            editor.virtualFile.url,
            editor.caretModel.primaryCaret.logicalPosition.line,
            editor.caretModel.primaryCaret.logicalPosition.column
        )
        if (variant == null)
            return InlineCompletionSuggestion.Empty
        return InlineCompletionSingleSuggestion.build(elements = flowOf(InlineCompletionGrayTextElement(variant)))
    }

    private inner class NotifyingHandler : DefaultInlineCompletionInsertHandler() {

        override fun afterInsertion(
            environment: InlineCompletionInsertEnvironment,
            elements: List<InlineCompletionElement>
        ) {
            super.afterInsertion(environment, elements)
            lastProject?.service<CompletionService>()?.acceptAutocomplete(lastUuid)
        }
    }
}