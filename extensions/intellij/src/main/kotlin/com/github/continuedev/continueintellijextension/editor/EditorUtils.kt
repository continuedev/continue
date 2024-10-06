package com.github.continuedev.continueintellijextension.editor

import com.intellij.openapi.editor.Editor

class EditorUtils {
    fun isTerminal(editor: Editor): Boolean {
       return editor.javaClass.name.contains("Terminal")
    }
}