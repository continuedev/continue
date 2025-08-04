package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.codeInsight.inline.completion.DefaultInlineCompletionInsertHandler
import com.intellij.codeInsight.inline.completion.InlineCompletionEvent
import com.intellij.codeInsight.inline.completion.InlineCompletionInsertEnvironment
import com.intellij.codeInsight.inline.completion.InlineCompletionInsertHandler
import com.intellij.codeInsight.inline.completion.InlineCompletionProvider
import com.intellij.codeInsight.inline.completion.InlineCompletionProviderID
import com.intellij.codeInsight.inline.completion.InlineCompletionRequest
import com.intellij.codeInsight.inline.completion.elements.InlineCompletionElement
import com.intellij.codeInsight.inline.completion.elements.InlineCompletionGrayTextElement
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionSuggestion
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionVariant
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.flow.flow

class ContinueInlineCompletionProvider : InlineCompletionProvider {
    override val id get() = InlineCompletionProviderID("Continue")
    override val insertHandler: InlineCompletionInsertHandler = NotifyingHandler()
    private var lastUuid: String? = null
    private var lastProject: Project? = null

    override fun isEnabled(event: InlineCompletionEvent): Boolean =
        ContinueExtensionSettings.instance.continueState.enableTabAutocomplete

    override suspend fun getSuggestion(request: InlineCompletionRequest): InlineCompletionSuggestion {
        val editor = request.editor
        val project = editor.project
            ?: return InlineCompletionSuggestion.Empty
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
        return object : InlineCompletionSuggestion {
            override suspend fun getVariants(): List<InlineCompletionVariant> {
                val completion = InlineCompletionVariant.build(
                    request.file.virtualFile,
                    flow { emit(InlineCompletionGrayTextElement(variant)) }
                )
                return listOf(completion)
            }
        }
    }

    // todo: we're hacking here with this handler + lastUuid and lastProject variables
    // todo: because we simply want to get notified which completion is accepted (this sounds like a common problem!)
    // todo: search for simpler solution / ask jetbrains why it's so complicated
    private inner class NotifyingHandler() : InlineCompletionInsertHandler {
        override fun afterInsertion(
            environment: InlineCompletionInsertEnvironment,
            elements: List<InlineCompletionElement>
        ) {
            DefaultInlineCompletionInsertHandler.INSTANCE.afterInsertion(environment, elements)
            lastProject?.service<CompletionService>()?.acceptAutocomplete(lastUuid)
        }
    }
}