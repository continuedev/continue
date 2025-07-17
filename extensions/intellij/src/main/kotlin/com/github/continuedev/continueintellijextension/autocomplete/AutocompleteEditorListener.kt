package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.nextEdit.NextEditService
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorKind
import com.intellij.openapi.editor.event.*
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.util.TextRange

class AutocompleteCaretListener : CaretListener {
    override fun caretPositionChanged(event: CaretEvent) {
        if(event.editor.editorKind != EditorKind.MAIN_EDITOR) {
            return
        }

        val caret = event.caret ?: return
        val offset = caret.offset
        val editor = caret.editor
        val autocompleteService = editor.project?.service<AutocompleteService>() ?: return

        if (autocompleteService.lastChangeWasPartialAccept) {
            autocompleteService.lastChangeWasPartialAccept = false
            return
        }

        val pending = autocompleteService.pendingCompletion;
        if (pending != null && pending.editor == editor && pending.offset == offset) {
            return
        }
        autocompleteService.clearCompletions(editor)
    }
}

class AutocompleteDocumentListener(private val editorManager: FileEditorManager, private val editor: Editor) :
    DocumentListener {
    override fun documentChanged(event: DocumentEvent) {
        // Ignore empty changes or changes where content didn't actually change.
        if (event.newFragment.isEmpty() && event.oldFragment.isEmpty()) {
            return
        }

        // Make sure this is an actual text modification event.
        if (!event.isWholeTextReplaced && event.offset == 0 && event.oldLength == 0 && event.newLength == 0) {
            return
        }

        if (editor != editorManager.selectedTextEditor) {
            return
        }

        val service = editor.project?.service<AutocompleteService>() ?: return
        if (service.lastChangeWasPartialAccept) {
            return
        }

        val nextEditService = editor.project?.service<NextEditService>() ?: return

        // Check if we're in a test environment based on some property or condition
        val isAutocompleteTestEnvironment = System.getProperty("continue.autocomplete.test.environment") == "true"
        val isNextEditTestEnvironment = System.getProperty("continue.nextEdit.test.environment") == "true"

        if (isAutocompleteTestEnvironment) {
            invokeLater {
                service.triggerCompletion(editor)
            }
            return
        } else if (isNextEditTestEnvironment) {
            invokeLater {
                nextEditService.triggerNextEdit(editor)
            }
            return
        }

        // Check settings to see if next edit is enabled, and then trigger either autocomplete or next exit.
        val continuePluginService = editor.project?.service<ContinuePluginService>()
        if (continuePluginService == null) {
            return
        }

        continuePluginService.coreMessenger?.request(
            "config/getSerializedProfileInfo",
            null,
            null,
            ({ response ->
                val optInNextEditFeature = response.castNestedOrNull<Boolean>(
                    "content",
                    "result",
                    "config",
                    "experimental",
                    "optInNextEditFeature"
                ) ?: false

                invokeLater {
                    if (optInNextEditFeature) {
                        nextEditService.triggerNextEdit(editor)
                    } else {
                        // Invoke later is important, otherwise the completion will be triggered before the document is updated
                        // causing the old caret offset to be used
                        // TODO: concurrency
                        service.triggerCompletion(editor)
                    }
                }
            })
        )
    }
}

class AutocompleteEditorListener : EditorFactoryListener {
    private val disposables = mutableMapOf<Editor, () -> Unit>()
    override fun editorCreated(event: EditorFactoryEvent) {
        val editor = event.editor
        val project = editor.project ?: return
        val editorManager = project.let { FileEditorManager.getInstance(it) } ?: return
        val completionProvider = project.service<AutocompleteService>()

        // Listen to changes to mouse position
        val caretListener = AutocompleteCaretListener()
        editor.caretModel.addCaretListener(caretListener)

        // Listen to changes to selection
        val connection = editor.project?.messageBus?.connect()
        connection?.subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
            override fun selectionChanged(event: FileEditorManagerEvent) {
                completionProvider.clearCompletions(editor)
            }
        })

        // Listen to changes to content
        val documentListener = AutocompleteDocumentListener(editorManager, editor)
        editor.document.addDocumentListener(documentListener)

        disposables[editor] = {
            editor.caretModel.removeCaretListener(caretListener)
            connection?.disconnect()
            editor.document.removeDocumentListener(documentListener)
        }
    }

    override fun editorReleased(event: EditorFactoryEvent) {
        val editor = event.editor
        val disposable = disposables[editor]
        disposable?.invoke()
        disposables.remove(editor)
    }
}