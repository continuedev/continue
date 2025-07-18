package com.github.continuedev.continueintellijextension.nextEdit

import com.github.continuedev.continueintellijextension.FimResult
import com.github.continuedev.continueintellijextension.autocomplete.AutocompleteLookupListener
import com.github.continuedev.continueintellijextension.autocomplete.AutocompleteSpinnerWidget
import com.github.continuedev.continueintellijextension.autocomplete.ContinueInlayRenderer
import com.github.continuedev.continueintellijextension.autocomplete.PendingCompletion
import com.github.continuedev.continueintellijextension.autocomplete.addInlayElement
import com.github.continuedev.continueintellijextension.autocomplete.isInjectedText
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.checkFim
import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.WriteAction
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.application.runReadAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.InlayProperties
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.wm.WindowManager
import com.intellij.psi.PsiDocumentManager

@Service(Service.Level.PROJECT)
class NextEditService(private val project: Project) {
    var pendingCompletion: PendingCompletion? = null
    private val autocompleteLookupListener = project.service<AutocompleteLookupListener>()
    private val widget: AutocompleteSpinnerWidget? by lazy {
        WindowManager.getInstance().getStatusBar(project)
            ?.getWidget(AutocompleteSpinnerWidget.ID) as? AutocompleteSpinnerWidget
    }

    // To avoid triggering another completion on partial acceptance,
    // we need to keep track of whether the last change was a partial accept.
    var lastChangeWasPartialAccept = false

    fun triggerNextEdit(editor: Editor) {
        val settings = service<ContinueExtensionSettings>()
        if (!settings.continueState.enableTabAutocomplete) {
            return
        }

        if (pendingCompletion != null) {
            clearCompletions(pendingCompletion!!.editor)
        }

        // Set pending completion.
        val completionId = uuid()
        val offset = editor.caretModel.primaryCaret.offset
        pendingCompletion = PendingCompletion(editor, offset, completionId, null)

        // Request a completion from the core.
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)

        val uri = virtualFile?.toUriOrNull() ?: return

        widget?.setLoading(true)

        val line = editor.caretModel.primaryCaret.logicalPosition.line
        val column = editor.caretModel.primaryCaret.logicalPosition.column
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

        // TODO: Add message support for nextEdit/predict.
        project.service<ContinuePluginService>().coreMessenger?.request(
            "nextEdit/predict",
            input,
            null,
            ({ response ->
                if (pendingCompletion == null || pendingCompletion?.completionId == completionId) {
                    widget?.setLoading(false)
                }

                val responseObject = response as Map<*, *>
                val predictions = responseObject["content"] as List<*>

                if (predictions.isNotEmpty()) {
                    val prediction = predictions[0].toString()
                    val oldEditRange = predictions[1].toString()
                    // Check if the prediction is purely additive.
                    val result = checkFim(
                        oldEditRange,
                        prediction,
                        Pair(line, column)
                    )
                    when (result) {
                        is FimResult.FimEdit -> {
                            // If so, render ghost text.
                            val finalTextToInsert = deduplicateCompletion(editor, offset, result.fimText)
                            if (shouldRenderCompletion(finalTextToInsert, offset, line, editor)) {
                                renderCompletion(editor, offset, finalTextToInsert)
                                pendingCompletion = PendingCompletion(editor, offset, completionId, finalTextToInsert)
                            }
                        }
                        is FimResult.NotFimEdit -> {
                            // Else, render a window.
                            if (shouldRenderCompletion(prediction, offset, line, editor)) {
                                val nextEditWindowService = NextEditWindowService.getInstance(project)
                                nextEditWindowService.showCodePreview(prediction, editor, completionId)
                            }
                        }
                    }
                }
            })
        )
    }

    private fun shouldRenderCompletion(completion: String, offset: Int, line: Int, editor: Editor): Boolean {
        if (completion.isEmpty() || runReadAction { offset != editor.caretModel.offset }) {
            return false
        }

        if (completion.lines().size == 1) {
            return true
        }

        val endOffset = editor.document.getLineEndOffset(line)

        // Do not render if completion is multi-line and caret is in middle of line
        return offset <= endOffset && editor.document.getText(TextRange(offset, endOffset)).isBlank()
    }

    private fun deduplicateCompletion(editor: Editor, offset: Int, completion: String): String {
        // Check if completion matches the first 10 characters after the cursor
        return ApplicationManager.getApplication().runReadAction<String> {
            val document = editor.document
            val caretOffset = editor.caretModel.offset

            // Don't care about it if it's at the end of the document
            if (caretOffset == document.textLength) return@runReadAction completion

            val N = 10
            var textAfterCursor = if (caretOffset + N <= document.textLength) {
                document.getText(TextRange(caretOffset, caretOffset + N))
            } else {
                document.getText(TextRange(caretOffset, document.textLength))
            }

            // Avoid truncating the completion text when the text after the cursor is blank
            if (textAfterCursor.isBlank()) return@runReadAction completion

            // Determine the index of a newline character within the text following the cursor.
            val newlineIndex = textAfterCursor.indexOf("\r\n").takeIf { it >= 0 } ?: textAfterCursor.indexOf('\n')
            // If a newline character is found and the current line is not empty, truncate the text at that point.
            if (newlineIndex > 0) {
                textAfterCursor = textAfterCursor.substring(0, newlineIndex)
            }

            val indexOfTextAfterCursorInCompletion = completion.indexOf(textAfterCursor)
            if (indexOfTextAfterCursorInCompletion > 0) {
                return@runReadAction completion.slice(0..indexOfTextAfterCursorInCompletion - 1)
            } else if (indexOfTextAfterCursorInCompletion == 0) {
                return@runReadAction ""
            }

            return@runReadAction completion
        }
    }

    private fun renderCompletion(editor: Editor, offset: Int, completion: String) {
        if (completion.isEmpty()) {
            return
        }
        if (isInjectedFile(editor)) return
        // Skip rendering completions if the code completion dropdown is already visible and the IDE completion side-by-side setting is disabled
        if (shouldSkipRender()) {
            return
        }

        ApplicationManager.getApplication().invokeLater {
            WriteAction.run<Throwable> {
                // Clear existing completions
                hideCompletions(editor)

                val properties = InlayProperties()
                properties.relatesToPrecedingText(true)
                properties.disableSoftWrapping(true)

                val lines = completion.lines()
                pendingCompletion = pendingCompletion?.copy(text = lines.joinToString("\n"))
                editor.addInlayElement(lines, offset, properties)

//                val attributes = TextAttributes().apply {
//                    backgroundColor = JBColor.GREEN
//                }
//                val key = TextAttributesKey.createTextAttributesKey("CONTINUE_AUTOCOMPLETE")
//                key.let { editor.colorsScheme.setAttributes(it, attributes) }
//                editor.markupModel.addLineHighlighter(key, editor.caretModel.logicalPosition.line, HighlighterLayer.LAST)
            }
        }
    }

    fun accept() {
        val completion = pendingCompletion ?: return
        val text = completion.text ?: return
        val editor = completion.editor
        val offset = completion.offset
        editor.document.insertString(offset, text)

        editor.caretModel.moveToOffset(offset + text.length)

        project.service<ContinuePluginService>().coreMessenger?.request(
            "nextEdit/accept",
            hashMapOf("completionId" to completion.completionId),
            null,
            ({})
        )
        invokeLater {
            clearCompletions(editor, completion)
        }
    }

    private fun shouldSkipRender(): Boolean {
        val settings = service<ContinueExtensionSettings>()
        return !settings.continueState.showIDECompletionSideBySide && !autocompleteLookupListener.isLookupEmpty()
    }

    private fun splitKeepingDelimiters(input: String, delimiterPattern: String = "\\s+"): List<String> {
        val initialSplit = input.split("(?<=$delimiterPattern)|(?=$delimiterPattern)".toRegex())
            .filter { it.isNotEmpty() }

        val result = mutableListOf<String>()
        var currentDelimiter = ""

        for (part in initialSplit) {
            if (part.matches(delimiterPattern.toRegex())) {
                currentDelimiter += part
            } else {
                if (currentDelimiter.isNotEmpty()) {
                    result.add(currentDelimiter)
                    currentDelimiter = ""
                }
                result.add(part)
            }
        }

        if (currentDelimiter.isNotEmpty()) {
            result.add(currentDelimiter)

        }

        return result
    }

    fun partialAccept() {
        val completion = pendingCompletion ?: return
        val text = completion.text ?: return
        val editor = completion.editor
        val offset = completion.offset

        lastChangeWasPartialAccept = true

        // Split the text into words, keeping delimiters
        val words = splitKeepingDelimiters(text)
        println(words)
        val word = words[0]
        editor.document.insertString(offset, word)
        editor.caretModel.moveToOffset(offset + word.length)

        // Remove the completion and re-display it
        hideCompletions(editor)
        completion.text = text.substring(word.length)
        completion.offset += word.length
        renderCompletion(editor, completion.offset, completion.text!!)
    }

    private fun rejectCompletion(completion: PendingCompletion) {
        // Send rejection message to core
        widget?.setLoading(false)
        project.service<ContinuePluginService>().coreMessenger?.request("nextEdit/reject", null, null, ({}))
    }

    fun clearCompletions(editor: Editor, completion: PendingCompletion? = pendingCompletion) {
        if (isInjectedFile(editor)) return

        if (completion != null) {
//            cancelCompletion(completion)
            if (completion.completionId == pendingCompletion?.completionId) pendingCompletion = null
        }
        disposeInlayRenderer(editor)
    }

    private fun isInjectedFile(editor: Editor): Boolean {
        return runReadAction {
            PsiDocumentManager.getInstance(project).getPsiFile(editor.document)?.isInjectedText() ?: false
        }
    }

    fun hideCompletions(editor: Editor) {
        if (isInjectedFile(editor)) return

        disposeInlayRenderer(editor)
    }

    private fun disposeInlayRenderer(editor: Editor) {
        editor.inlayModel.getInlineElementsInRange(0, editor.document.textLength).forEach {
            if (it.renderer is ContinueInlayRenderer) {
                it.dispose()
            }
        }
        editor.inlayModel.getBlockElementsInRange(0, editor.document.textLength).forEach {
            if (it.renderer is ContinueInlayRenderer) {
                it.dispose()
            }
        }
    }
}