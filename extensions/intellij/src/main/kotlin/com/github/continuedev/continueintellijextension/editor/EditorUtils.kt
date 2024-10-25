package com.github.continuedev.continueintellijextension.editor

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.ui.JBColor

class EditorUtils {
    fun isTerminal(editor: Editor): Boolean {
       return editor.javaClass.name.contains("Terminal")
    }
}

fun createTextAttributesKey(name: String, color: Int, editor: Editor): TextAttributesKey {
    val attributes = TextAttributes().apply {
        backgroundColor = JBColor(color, color)
    }

    return TextAttributesKey.createTextAttributesKey(name).also {
        editor.colorsScheme.setAttributes(it, attributes)
    }
}
