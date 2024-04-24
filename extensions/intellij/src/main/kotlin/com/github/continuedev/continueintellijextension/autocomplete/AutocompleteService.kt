package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.`continue`.uuid
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.WriteAction
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.InlayProperties
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project

data class PendingCompletion (
    val editor: Editor,
    val offset: Int,
    val completionId: String,
    val text: String?
)

@Service(Service.Level.PROJECT)
class AutocompleteService(private val project: Project) {
    var pendingCompletion: PendingCompletion? = null;

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

        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/complete", input, null, ({ response ->
            val completions = Gson().fromJson(response, List::class.java)
            if (completions.isNotEmpty()) {
                val completion = completions[0].toString()

                if (completion.lines().size === 1 || column >= lineLength) {
                    // Do not render if completion is multi-line and caret is in middle of line
                    renderCompletion(editor, offset, completion)
                    pendingCompletion = pendingCompletion?.copy(text = completion)

                    // Hide auto-popup
//                    AutoPopupController.getInstance(project).cancelAllRequests()
                }
            }
        }))
    }

    private fun renderCompletion(editor: Editor, offset: Int, text: String) {
        ApplicationManager.getApplication().invokeLater {
            WriteAction.run<Throwable> {
                val properties = InlayProperties()
                properties.relatesToPrecedingText(true)
                properties.disableSoftWrapping(true)

                if (text.lines().size > 1) {
                    editor.inlayModel.addBlockElement(offset, properties, ContinueMultilineCustomElementRenderer(editor, text))
                } else {
                    editor.inlayModel.addInlineElement(offset, properties, ContinueCustomElementRenderer(editor, text))
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

        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/accept", completion.completionId, null, ({}))
        invokeLater {
            clearCompletions(editor)
        }
    }

    private fun cancelCompletion(completion: PendingCompletion) {
        // Send cancellation message to core
        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/cancel", null,null, ({}))
    }

    fun clearCompletions(editor: Editor) {
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
}
