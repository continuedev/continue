package com.github.continuedev.continueintellijextension.`continue`
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorColorsScheme
import com.intellij.openapi.editor.colors.TextAttributesKey

/*
[
  "--vscode-input-background",
  "--vscode-sideBar-background",
  "--vscode-editor-foreground",
  "--vscode-button-background",
  "--vscode-editor-background",
  "--vscode-list-activeSelectionBackground",
  "--vscode-focus-border",
  "--vscode-quickInputList-focusForeground",
  "--vscode-quickInput-background",
  "--vscode-input-border",
  "--vscode-focusBorder",
  "--vscode-badge-background",
  "--vscode-badge-foreground",
  "--vscode-sideBar-border"
]

 */
val vscToJetBrainsColorName = listOf(
    arrayOf("--vscode-input-background", "?"),
    arrayOf("--vscode-sideBar-background", "?"),
    arrayOf("--vscode-editor-foreground", "?"),

)

class GetTheme {
    fun getTheme(): EditorColorsScheme {
        val editorColorsManager: EditorColorsManager = EditorColorsManager.getInstance()
        val scheme: EditorColorsScheme = editorColorsManager.globalScheme
        return scheme
    }
}