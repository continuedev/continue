package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.FimResult
import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.nextEdit.NextEditService
import com.github.continuedev.continueintellijextension.nextEdit.NextEditUtils
import com.github.continuedev.continueintellijextension.nextEdit.NextEditWindowManager
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
    private var isUsingNextEdit = false

    override fun isEnabled(event: InlineCompletionEvent): Boolean =
        ContinueExtensionSettings.instance.continueState.enableTabAutocomplete

    override suspend fun getSuggestion(request: InlineCompletionRequest): InlineCompletionSuggestion {
        val editor = request.editor
        val project = editor.project
            ?: return InlineCompletionSuggestion.Empty
        lastUuid = uuid()
        lastProject = project

        // Check if Next Edit is supported
        val isNextEditSupported = NextEditUtils.isNextEditSupported(project)

        if (isNextEditSupported) {
            val currCursorPos = Pair(
                editor.caretModel.primaryCaret.logicalPosition.line,
                editor.caretModel.primaryCaret.logicalPosition.column
            )
            // Use Next Edit - but don't return inline completion for it
            val nextEditService = project.service<NextEditService>()
            val nextEditOutcome = nextEditService.getNextEditSuggestion(
                lastUuid!!,
                editor.virtualFile.url,
                currCursorPos.first,
                currCursorPos.second
            )

            if (nextEditOutcome != null) {
                val editableRegionStartLine = nextEditOutcome.editableRegionStartLine
                val editableRegionEndLine = nextEditOutcome.editableRegionEndLine
                val oldEditRangeSlice = editor.document.text
                    .split("\n")
                    .drop(editableRegionStartLine)
                    .take(editableRegionEndLine - editableRegionStartLine + 1)
                    .joinToString("\n")

                // Check if it's a FIM (Fill-In-Middle) operation
                val fimResult = NextEditUtils.checkFim(
                    oldEditRangeSlice, // Use the extracted slice instead of nextEditOutcome.oldCode
                    nextEditOutcome.completion,
                    currCursorPos
                )

                when (fimResult) {
                    is FimResult.FimEdit -> {
                        // Render as gray text inline completion
                        isUsingNextEdit = true
                        return object : InlineCompletionSuggestion {
                            override suspend fun getVariants(): List<InlineCompletionVariant> {
                                val completion = InlineCompletionVariant.build(
                                    request.file.virtualFile,
                                    flow { emit(InlineCompletionGrayTextElement(fimResult.fimText)) }
                                )
                                return listOf(completion)
                            }
                        }
                    }
                    is FimResult.NotFimEdit -> {
                        // For non-FIM operations, show custom UI and return empty
                        val nextEditWindowManager = project.service<NextEditWindowManager>()
                        isUsingNextEdit = true
                        nextEditWindowManager.showNextEditWindow(
                            editor,
                            Position(currCursorPos.first, currCursorPos.second),
                            editableRegionStartLine,
                            editableRegionEndLine,
                            oldEditRangeSlice,
                            nextEditOutcome.completion,
                            nextEditOutcome.diffLines,
                        )
                        return InlineCompletionSuggestion.Empty
                    }
                }
            }
            return InlineCompletionSuggestion.Empty
        } else {
            // Use traditional autocomplete
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

            if (isUsingNextEdit) {
                lastProject?.service<NextEditService>()?.acceptEdit(lastUuid ?: "")
            } else {
                lastProject?.service<CompletionService>()?.acceptAutocomplete(lastUuid)
            }
        }
    }
}