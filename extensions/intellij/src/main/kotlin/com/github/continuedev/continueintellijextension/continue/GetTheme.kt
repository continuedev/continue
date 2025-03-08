package com.github.continuedev.continueintellijextension.`continue`

import com.intellij.openapi.editor.colors.EditorColors
import com.intellij.openapi.editor.colors.EditorColorsManager
import java.awt.Color
import kotlin.math.max
import kotlin.math.min
import com.intellij.ui.JBColor
import com.intellij.ui.ColorUtil

class GetTheme {
    fun getSecondaryDark(): Color {
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        val defaultBackground = globalScheme.defaultBackground
        val grayscale =
            (defaultBackground.red * 0.3 + defaultBackground.green * 0.59 + defaultBackground.blue * 0.11).toInt()

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

        return Color(adjustedRed, adjustedGreen, adjustedBlue)
    }

    fun getHighlight(): Color {
        val globalScheme = EditorColorsManager.getInstance().globalScheme
        return globalScheme.getColor(EditorColors.MODIFIED_TAB_ICON_COLOR) ?: globalScheme.defaultForeground
    }

    fun getTheme(): Map<String, String> {
        fun toHex(color: Color): String {
            return String.format("#%02x%02x%02x", color.red, color.green, color.blue)
        }
        try {
            val background = JBColor.background()
            val foreground = JBColor.foreground()

            val buttonBackground = JBColor.namedColor("Button.background", Color(230, 230, 230))
            val buttonForeground = JBColor.namedColor("Button.foreground", Color(0, 0, 0))

            val badgeBackground = JBColor.namedColor("Badge.background", Color(150, 150, 150))
            val badgeForeground = JBColor.namedColor("Badge.foreground", Color(0, 0, 0))

            val inputBackground = JBColor.namedColor("TextField.background", Color(255, 255, 255))

            val border = JBColor.border()
            val focusBorder = JBColor.namedColor("Focus.borderColor", Color(100, 100, 255))
            val editorScheme = EditorColorsManager.getInstance().globalScheme

            val editorBackground = editorScheme.defaultBackground
            val editorForeground = editorScheme.defaultForeground

            val actionHoverBackground = JBColor.namedColor("ActionButton.hoverBackground", Color(220, 220, 220))

            val findMatchBackground = editorScheme.getAttributes(EditorColors.SEARCH_RESULT_ATTRIBUTES)?.backgroundColor ?: Color(255, 221, 0)

            val theme = mapOf(
                "--vscode-editor-foreground" to toHex(editorForeground),
                "--vscode-editor-background" to toHex(editorBackground),

                "--vscode-button-background" to toHex(buttonBackground),
                "--vscode-button-foreground" to toHex(buttonForeground),

                "--vscode-list-activeSelectionBackground" to toHex(actionHoverBackground) + "50",

                "--vscode-quickInputList-focusForeground" to toHex(foreground),
                "--vscode-quickInput-background" to toHex(inputBackground),

                "--vscode-badge-background" to toHex(badgeBackground),
                "--vscode-badge-foreground" to toHex(badgeForeground),

                "--vscode-input-background" to toHex(inputBackground),
                "--vscode-input-border" to toHex(border),
                "--vscode-sideBar-background" to toHex(background),
                "--vscode-sideBar-border" to toHex(border),
                "--vscode-focusBorder" to toHex(focusBorder),

                "--vscode-commandCenter-activeBorder" to toHex(focusBorder),
                "--vscode-commandCenter-inactiveBorder" to toHex(border),

                "--vscode-editor-findMatchHighlightBackground" to toHex(findMatchBackground) + "40"
            )

            return theme
        } catch (error: Error) {
            return mapOf()
        }

    }
}