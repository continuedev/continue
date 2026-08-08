package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.ApplyState
import com.github.continuedev.continueintellijextension.ApplyStateStatus
import com.github.continuedev.continueintellijextension.IDE
import com.github.continuedev.continueintellijextension.ToastType
import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.github.continuedev.continueintellijextension.editor.DiffStreamHandler
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.github.continuedev.continueintellijextension.editor.EditorUtils
import com.github.continuedev.continueintellijextension.protocol.ApplyToFileParams
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project

/**
 * Handles applying text to a file with streaming diff preview
 */
class ApplyToFileHandler(
    private val project: Project,
    private val continuePluginService: ContinuePluginService,
    private val ide: IDE,
    private val params: ApplyToFileParams,
    private val editorUtils: EditorUtils?,
    private val diffStreamService: DiffStreamService
) {

    // Store the original file content before applying changes
    private val originalFileContent: String? = editorUtils?.getDocumentText()

    suspend fun handleApplyToFile() {
        // Notify webview that we're starting to stream
        notifyStreamStarted()

        if (editorUtils == null) {
            ide.showToast(ToastType.ERROR, "No active editor to apply edits to")
            notifyStreamClosed()
            return
        }

        if (editorUtils.isDocumentEmpty()) {
            editorUtils.insertTextIntoEmptyDocument(params.text)
            notifyStreamClosed()
            return
        }

        // Handle search/replace mode
        if (params.isSearchAndReplace == true) {
            handleSearchReplace(editorUtils)
            return
        }

        // Get the LLM configuration for applying edits
        val llm = fetchApplyLLMConfig() ?: run {
            ide.showToast(ToastType.ERROR, "Failed to fetch model configuration")
            notifyStreamClosed()
            return
        }

        setupAndStreamDiffs(editorUtils, llm)
    }

    /**
     * Handle search and replace operations
     *
     * For search/replace, we always get a full file rewrite of the contents.
     * We just need to generate diff lines between the current content and new content,
     * then stream them through the existing infrastructure.
     */
    private fun handleSearchReplace(editorUtils: EditorUtils) {
        // Clear all diff blocks before running the diff stream
        diffStreamService.reject(editorUtils.editor)

        // Get current file content and the new content (full rewrite)
        val currentContent = editorUtils.getDocumentText()
        val newContent = params.text

        // Work with the entire document
        val startLine = 0
        val endLine = editorUtils.getLineCount() - 1
        // Create and register the diff stream handler
        val diffStreamHandler = createDiffStreamHandler(editorUtils.editor, startLine, endLine)
        diffStreamService.register(diffStreamHandler, editorUtils.editor)

        diffStreamHandler.instantApplyDiffLines(currentContent, newContent)
    }

    private fun notifyStreamStarted() {
        sendApplyStateUpdate(ApplyStateStatus.STREAMING)
    }

    private fun notifyStreamClosed(numDiffs: Int? = 0) {
        sendApplyStateUpdate(ApplyStateStatus.CLOSED, numDiffs)
    }
    private fun sendApplyStateUpdate(
        status: ApplyStateStatus, numDiffs: Int? = null
    ) {
        val payload = ApplyState(
            streamId = params.streamId,
            status = status.status,
            numDiffs = numDiffs,
            filepath = params.filepath,
            fileContent = params.text,
            originalFileContent = originalFileContent,
            toolCallId = params.toolCallId.toString()
        )

        project.getBrowser()?.sendToWebview("updateApplyState", payload)
    }

    private suspend fun fetchApplyLLMConfig(): Any? {
        val selectedModelByRole = project.service<ProfileInfoService>().fetchSelectedModelByRoleOrNull()
        return selectedModelByRole?.get("apply")
            ?: selectedModelByRole?.get("chat")
    }

    private fun setupAndStreamDiffs(editorUtils: EditorUtils, llm: Any) {
        // Clear all diff blocks before running the diff stream
        diffStreamService.reject(editorUtils.editor)

        val llmTitle = (llm as? Map<*, *>)?.get("title") as? String ?: ""
        val prompt = buildApplyPrompt()

        // Extract the code ranges (highlighted or full document)
        val (prefix, highlighted, suffix) = editorUtils.getHighlightedRangeTriplet()

        // Get the line range for the diff stream
        val rif = editorUtils.getHighlightedRIF()
        val startLine = rif?.range?.start?.line ?: 0
        val endLine = rif?.range?.end?.line ?: (editorUtils.getLineCount() - 1)

        // Create and register the diff stream handler
        val diffStreamHandler = createDiffStreamHandler(editorUtils.editor, startLine, endLine)
        diffStreamService.register(diffStreamHandler, editorUtils.editor)

        // Stream the diffs
        diffStreamHandler.streamDiffLinesToEditor(
            prompt, prefix, highlighted, suffix, llmTitle, false, true
        )
    }

    private fun buildApplyPrompt(): String {
        return "The following code was suggested as an edit:\n```\n${params.text}\n```\nPlease apply it to the previous code. Leave existing comments in place unless changes require modifying them."
    }

    private fun createDiffStreamHandler(
        editor: Editor, startLine: Int, endLine: Int
    ): DiffStreamHandler {
        return DiffStreamHandler(
            project,
            editor,
            startLine,
            endLine,
            {},
            {},
            params.streamId,
            params.toolCallId.toString()
        )
    }

    companion object {
        /**
         * Factory method to create and execute a new handler for a single apply-to-file operation
         */
        suspend fun apply(
            project: Project, continuePluginService: ContinuePluginService, ide: IDE, params: ApplyToFileParams
        ) {
            val editorUtils =
                if (EditorUtils.editorFileExist(params.filepath)) EditorUtils.getOrOpenEditor(project, params.filepath)
                else EditorUtils.getEditorByCreateFile(project, params.filepath)

            val diffStreamService = project.service<DiffStreamService>()

            val handler = ApplyToFileHandler(
                project, continuePluginService, ide, params, editorUtils, diffStreamService
            )

            handler.handleApplyToFile()
        }
    }
}
