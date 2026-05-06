package com.github.yutoagentic.yutoagenticintellijextension.autocomplete

import com.github.yutoagentic.yutoagenticintellijextension.FimResult
import com.github.yutoagentic.yutoagenticintellijextension.Position
import com.github.yutoagentic.yutoagenticintellijextension.nextEdit.NextEditJumpManager
import com.github.yutoagentic.yutoagenticintellijextension.nextEdit.NextEditService
import com.github.yutoagentic.yutoagenticintellijextension.nextEdit.NextEditStatusService
import com.github.yutoagentic.yutoagenticintellijextension.nextEdit.NextEditUtils
import com.github.yutoagentic.yutoagenticintellijextension.nextEdit.NextEditWindowManager
import com.github.yutoagentic.yutoagenticintellijextension.services.ContinueExtensionSettings
import com.github.yutoagentic.yutoagenticintellijextension.utils.uuid
import com.intellij.codeInsight.inline.completion.*
import com.intellij.codeInsight.inline.completion.elements.InlineCompletionElement
import com.intellij.codeInsight.inline.completion.elements.InlineCompletionGrayTextElement
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionSingleSuggestion
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionSuggestion
import com.intellij.codeInsight.inline.completion.suggestion.InlineCompletionVariant
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

class ContinueInlineCompletionProvider : InlineCompletionProvider {
    override val id get() = InlineCompletionProviderID("Continue")
    override val insertHandler: InlineCompletionInsertHandler = NotifyingHandler()
    private var lastUuid: String? = null
    private var lastProject: Project? = null
    private var isUsingNextEdit = false

    override fun isEnabled(event: InlineCompletionEvent): Boolean {
        val isSettingEnabled = ContinueExtensionSettings.instance.continueState.enableTabAutocomplete
        val isEventOk = event is InlineCompletionEvent.DirectCall
                || event is InlineCompletionEvent.DocumentChange
                || event is InlineCompletionEvent.LookupChange
        return isSettingEnabled && isEventOk
    }

    override suspend fun getSuggestion(request: InlineCompletionRequest): InlineCompletionSuggestion {
        val editor = request.editor
        val project = editor.project
            ?: return InlineCompletionSuggestion.Empty
        lastUuid = uuid()
        lastProject = project

        val isNextEditSupported = project.service<NextEditStatusService>().isNextEditEnabled()

        if (isNextEditSupported) {
            isUsingNextEdit = true
            val nextEditService = project.service<NextEditService>()
            val nextEditJumpManager = project.service<NextEditJumpManager>()

            val currCursorPos = Pair(
                editor.caretModel.primaryCaret.logicalPosition.line,
                editor.caretModel.primaryCaret.logicalPosition.column
            )

            val isJumping = nextEditJumpManager.isJumpInProgress()
            val chainExists = nextEditService.chainExists()
            val nextEditOutcome = when {
                isJumping && chainExists -> nextEditService.handleCase2() // Case 2: Jumping (chain exists, jump was taken).
                chainExists -> nextEditService.handleCase3(
                    editor,
                    currCursorPos
                ) // Case 3: Accepting next edit outcome (chain exists, jump is not taken).
                else -> nextEditService.handleCase1(
                    request,
                    editor,
                    currCursorPos,
                    lastUuid
                ) // Case 1: Typing (chain does not exist).
            }

            if (nextEditOutcome == null) {
                return InlineCompletionSuggestion.Empty
            }

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
                    nextEditWindowManager.showNextEditWindow(
                        editor,
                        Position(currCursorPos.first, currCursorPos.second),
                        editableRegionStartLine,
                        editableRegionEndLine,
                        oldEditRangeSlice,
                        nextEditOutcome.completion,
                        nextEditOutcome.diffLines,
                        lastUuid
                    )
                    return InlineCompletionSuggestion.Empty
                }
            }
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
            return InlineCompletionSingleSuggestion.build(elements = flowOf(InlineCompletionGrayTextElement(variant)))
        }
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