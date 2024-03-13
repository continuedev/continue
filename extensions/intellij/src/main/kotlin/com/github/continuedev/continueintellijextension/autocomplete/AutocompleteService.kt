package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.`continue`.uuid
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
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
        if (pendingCompletion != null) {
            clearCompletions(pendingCompletion!!.editor)
        }

        // Set pending completion
        val completionId = uuid()
        val offset = editor.caretModel.primaryCaret.offset
        pendingCompletion = PendingCompletion(editor, offset, completionId, null)

        // Request a completion from the core
        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/complete", completionId, null, ({ response ->
            val completion = response;
            renderCompletion(editor, offset, response)
            pendingCompletion = pendingCompletion?.copy(text = completion)
        }))
    }

    private fun renderCompletion(editor: Editor, offset: Int, text: String) {
        editor.inlayModel.addInlineElement(offset, true, ContinueCustomElementRenderer(editor, text))
    }

    fun accept() {
        val completion = pendingCompletion ?: return
        val text = completion.text ?: return
        val editor = completion.editor
        val offset = completion.offset
        editor.document.insertString(offset, text)
        clearCompletions(editor)
        project.service<ContinuePluginService>().coreMessenger?.request("autocomplete/accept", completion.completionId, null, ({}))
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
        editor.inlayModel.getInlineElementsInRange(0, editor.document.textLength).forEach { it.dispose() }
        editor.inlayModel.getBlockElementsInRange(0, editor.document.textLength).forEach { it.dispose() }
    }
}
