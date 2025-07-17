package com.github.continuedev.continueintellijextension.nextEdit

import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Caret
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.actionSystem.EditorAction
import com.intellij.openapi.editor.actionSystem.EditorActionHandler

class AcceptNextEditAction : EditorAction(object : EditorActionHandler() {
    override fun doExecute(editor: Editor, caret: Caret?, dataContext: DataContext?) {
        ApplicationManager.getApplication().runWriteAction {
            editor.project?.service<NextEditService>()?.accept()
        }
    }

    override fun isEnabledForCaret(editor: Editor, caret: Caret, dataContext: DataContext?): Boolean {
        val nextEditService = editor.project?.service<NextEditService>();
        val enabled = editor == nextEditService?.pendingCompletion?.editor
//                && caret.offset == autocompleteService.pendingCompletion?.offset
                && nextEditService.pendingCompletion?.text != null
        return enabled
    }
})