package com.github.continuedev.continueintellijextension.`continue`
import com.intellij.codeInsight.template.impl.TemplateColors
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.colors.EditorColors
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.EditorColorsScheme
import com.intellij.openapi.editor.colors.TextAttributesKey
import kotlin.math.max
import kotlin.math.min


class GetTheme {
    fun getTheme(): Map<String, String> {
        try {
            val globalScheme = EditorColorsManager.getInstance().globalScheme
            val defaultBackground = globalScheme.defaultBackground
            val defaultForeground = globalScheme.defaultForeground
            val highlight = globalScheme.getColor(EditorColors.MODIFIED_TAB_ICON_COLOR) ?: defaultForeground
            val defaultBackgroundHex = String.format("#%02x%02x%02x", defaultBackground.red, defaultBackground.green, defaultBackground.blue)
            val defaultForegroundHex = String.format("#%02x%02x%02x", defaultForeground.red, defaultForeground.green, defaultForeground.blue)
            val highlightHex = String.format("#%02x%02x%02x", highlight.red, highlight.green, highlight.blue)

            val grayscale = (defaultBackground.red * 0.3 + defaultBackground.green * 0.59 + defaultBackground.blue * 0.11).toInt()

            val adjustedRed: Int
            val adjustedGreen: Int
            val adjustedBlue: Int

            val tint: Int = 20
            if (grayscale > 128) { // if closer to white
                adjustedRed = max(0, defaultBackground.red - tint)
                adjustedGreen = max(0, defaultBackground.green - tint)
                adjustedBlue = max(0, defaultBackground.blue - tint)
            } else { // if closer to black
                adjustedRed = min(255, defaultBackground.red + tint)
                adjustedGreen = min(255, defaultBackground.green + tint)
                adjustedBlue = min(255, defaultBackground.blue + tint)
            }

            val secondaryDarkHex = String.format("#%02x%02x%02x", adjustedRed, adjustedGreen, adjustedBlue)

            return mapOf(
                    "--vscode-editor-foreground" to defaultForegroundHex,
                    "--vscode-sideBar-background" to defaultBackgroundHex,
                    "--vscode-input-background" to secondaryDarkHex,
                    "--vscode-editor-background" to defaultBackgroundHex,
                    "--vscode-button-background" to defaultBackgroundHex,
                    "--vscode-list-activeSelectionBackground" to defaultBackgroundHex,
                    "--vscode-focusBorder" to highlightHex,
                    "--vscode-quickInputList-focusForeground" to defaultForegroundHex,
                    "--vscode-quickInput-background" to secondaryDarkHex,
                    "--vscode-input-border" to "#80808080",
                    "--vscode-badge-background" to highlightHex,
                    "--vscode-badge-foreground" to defaultForegroundHex,
                    "--vscode-sideBar-border" to "#80808080"
            )

        } catch (error: Error) {
            return mapOf()
        }

    }
}