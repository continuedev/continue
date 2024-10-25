package com.github.continuedev.continueintellijextension.autocomplete

import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.event.*
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.util.TextRange

class AutocompleteCaretListener : CaretListener {
    override fun caretPositionChanged(event: CaretEvent) {
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
        if (editor != editorManager.selectedTextEditor) {
            return
        }

        val service = editor.project?.service<AutocompleteService>() ?: return
        if (service.lastChangeWasPartialAccept) {
            return
        }

        // Invoke later is important, otherwise the completion will be triggered before the document is updated
        // causing the old caret offset to be used
        // TODO: concurrency
        invokeLater {
            service.triggerCompletion(editor)
        }
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