package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.`continue`.uuid
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.injected.editor.VirtualFileWindow
import com.intellij.openapi.application.*
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.InlayProperties
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.WindowManager
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement

data class PendingCompletion(
    val editor: Editor,
    var offset: Int,
    val completionId: String,
    var text: String?
)


fun PsiElement.isInjectedText(): Boolean {
    val virtualFile = this.containingFile.virtualFile ?: return false
    if (virtualFile is VirtualFileWindow) {
        return true
    }
    return false
}

@Service(Service.Level.PROJECT)
class AutocompleteService(private val project: Project) {
    var pendingCompletion: PendingCompletion? = null;
    private val autocompleteLookupListener = project.service<AutocompleteLookupListener>()
    private var widget: AutocompleteSpinnerWidget? = null

    // To avoid triggering another completion on partial acceptance,
    // we need to keep track of whether the last change was a partial accept
    var lastChangeWasPartialAccept = false

    init {
        val statusBar = WindowManager.getInstance().getStatusBar(project)
        widget = statusBar.getWidget("AutocompleteSpinnerWidget") as? AutocompleteSpinnerWidget
    }

    fun triggerCompletion(editor: Editor) {
        val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
        if (!settings.continueState.enableTabAutocomplete) {
            return
        }

        if (pendingCompletion != null) {
            clearCompletions(pendingCompletion!!.editor)
        }

        // Set pending completion
        val completionId = uuid()
        val offset = editor.caretModel.primaryCaret.offset
        pendingCompletion = PendingCompletion(editor, offset, completionId, null)
        widget?.setLoading(true)

        // Request a completion from the core
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)
        val column = editor.caretModel.primaryCaret.logicalPosition.column
        val input = mapOf(
            "completionId" to completionId,
            "filepath" to virtualFile?.path,
            "pos" to mapOf(
                "line" to editor.caretModel.primaryCaret.logicalPosition.line,
                "character" to column
            ),
            "recentlyEditedFiles" to emptyList<String>(),
            "recentlyEditedRanges" to emptyList<String>(),
            "clipboardText" to ""
        )

        val lineStart = editor.document.getLineStartOffset(editor.caretModel.primaryCaret.logicalPosition.line)
        val lineEnd = editor.document.getLineEndOffset(editor.caretModel.primaryCaret.logicalPosition.line)
        val lineLength = lineEnd - lineStart

        project.service<ContinuePluginService>().coreMessenger?.request(
            "autocomplete/complete",
            input,
            null,
            ({ response ->
                widget?.setLoading(false)

                val completions = response as List<*>
                if (completions.isNotEmpty()) {
                    val completion = completions[0].toString()
                    val finalTextToInsert = deduplicateCompletion(editor, offset, completion)

                    if (shouldRenderCompletion(finalTextToInsert, column, lineLength, editor)) {
                        renderCompletion(editor, offset, finalTextToInsert)
                        pendingCompletion = pendingCompletion?.copy(text = finalTextToInsert)

                        // Hide auto-popup
//                    AutoPopupController.getInstance(project).cancelAllRequests()
                    }
                }
            })
        )
    }

    private fun shouldRenderCompletion(completion: String, column: Int, lineLength: Int, editor: Editor): Boolean {
        if (completion.isEmpty()) {
            return false
        }

        // Do not render if completion is multi-line and caret is in middle of line
        return !(completion.lines().size > 1 && column < lineLength)
    }

    private fun deduplicateCompletion(editor: Editor, offset: Int, completion: String): String {
        // Check if completion matches the first 10 characters after the cursor
        return ApplicationManager.getApplication().runReadAction<String> {
            val document = editor.document
            val caretOffset = editor.caretModel.offset
            val N = 10
            var textAfterCursor = if (caretOffset + N <= document.textLength) {
                document.getText(com.intellij.openapi.util.TextRange(caretOffset, caretOffset + N))
            } else {
                document.getText(com.intellij.openapi.util.TextRange(caretOffset, document.textLength))
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
        // Don't render completions when code completion dropdown is visible
        if (!autocompleteLookupListener.isLookupEmpty()) {
            return
        }

        ApplicationManager.getApplication().invokeLater {
            WriteAction.run<Throwable> {
                // Clear existing completions
                hideCompletions(editor)

                val properties = InlayProperties()
                properties.relatesToPrecedingText(true)
                properties.disableSoftWrapping(true)

                if (completion.lines().size > 1) {
                    editor.inlayModel.addBlockElement(
                        offset,
                        properties,
                        ContinueMultilineCustomElementRenderer(editor, completion)
                    )
                } else {
                    editor.inlayModel.addInlineElement(
                        offset,
                        properties,
                        ContinueCustomElementRenderer(editor, completion)
                    )
                }

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
            "autocomplete/accept",
            completion.completionId,
            null,
            ({})
        )
        invokeLater {
            clearCompletions(editor)
        }
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

    private fun cancelCompletion(completion: PendingCompletion) {
        // Send cancellation message to core
        widget?.setLoading(false)
        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/cancel", null, null, ({}))
    }

    fun clearCompletions(editor: Editor) {
        if (isInjectedFile(editor)) return

        if (pendingCompletion != null) {
            cancelCompletion(pendingCompletion!!)
            pendingCompletion = null
        }
        editor.inlayModel.getInlineElementsInRange(0, editor.document.textLength).forEach {
            if (it.renderer is ContinueCustomElementRenderer) {
                it.dispose()
            }
        }
        editor.inlayModel.getBlockElementsInRange(0, editor.document.textLength).forEach {
            if (it.renderer is ContinueMultilineCustomElementRenderer) {
                it.dispose()
            }
        }
    }

    private fun isInjectedFile(editor: Editor): Boolean {
        val psiFile = runReadAction { PsiDocumentManager.getInstance(project).getPsiFile(editor.document) }
        if (psiFile == null) {
            return false
        }
        val response = runReadAction { psiFile.isInjectedText() }
        return response
    }

    fun hideCompletions(editor: Editor) {
        if (isInjectedFile(editor)) return

        editor.inlayModel.getInlineElementsInRange(0, editor.document.textLength).forEach {
            if (it.renderer is ContinueCustomElementRenderer) {
                it.dispose()
            }
        }
        editor.inlayModel.getBlockElementsInRange(0, editor.document.textLength).forEach {
            if (it.renderer is ContinueMultilineCustomElementRenderer) {
                it.dispose()
            }
        }
    }
}
