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

    fun toHex(color: Color?): String? {
        if(color == null) {
            return null
        }
        return String.format("#%02x%02x%02x", color.red, color.green, color.blue)
    }

    fun namedColor(name: String): Color? {
        // JB Color named color will fall back to a default unless we give it a fallback
        // We want defaults to be handled on the GUI side, so we give it this filler color
        // Which has a very low chance of conflicting with a real one
        // And return undefined if it gets the skip color
        val SKIP_COLOR = Color (18, 52, 86) // Hex #123456
        val color = JBColor.namedColor(name, SKIP_COLOR)
        if(toHex(color) == "#123456") {
            return null
        }
        return color
    }

    fun getTheme(): Map<String, String?> {
        try {
            // IDE colors
            val background = JBColor.background()
            val foreground = JBColor.foreground()

            val border = JBColor.border()
            val focusBorder = namedColor("Focus.borderColor") ?: namedColor("Component.focusedBorderColor")

            val buttonBackground = namedColor("Button.background")
            val buttonForeground = namedColor("Button.foreground")
            val buttonHoverBackground = namedColor("Button.hoverBackground") ?: namedColor("Button.darcula.hoverBackground")

            val badgeBackground = namedColor("Badge.background")
            val badgeForeground = namedColor("Badge.foreground")

            val commandBackground = namedColor("CommandButton.background") ?: namedColor("ToolWindow.background")
            val commandForeground = namedColor("CommandButton.foreground") ?: namedColor("ToolWindow.foreground")

            val inputBackground = namedColor("TextField.background")
            val inputForeground = namedColor("TextField.foreground")
            val inputPlaceholder = namedColor("TextField.inactiveForeground")

            val listHoverBackground = namedColor("List.hoverBackground") ?: namedColor("List.dropLineColor")
            val actionHoverBackground = namedColor("ActionButton.hoverBackground") ?: namedColor("Button.darcula.hoverBackground")
            val hoverBackground = namedColor("Table.hoverBackground") ?: namedColor("Table.stripeColor") ?: namedColor("List.dropLineColor")
            val listSelectionForeground = namedColor("List.selectionForeground")


            val description = namedColor("Label.infoForeground") ?: namedColor("ToolTip.foreground")
            val mutedDescription = namedColor("Label.disabledForeground")

            val link = namedColor("Link.activeForeground")

            val successColor = namedColor("Notification.Success.background") ?: namedColor("ProgressBar.progressColor")
            val warningColor = namedColor("Notification.Warning.background") ?: namedColor("ProgressBar.warningColor")
            val errorColor = namedColor("ErrorBackground") ?: namedColor("Notification.Error.background") ?: namedColor("ProgressBar.errorColor")
            val accentColor = namedColor("Focus.defaultButtonBorderColor") ?: namedColor("Button.default.focusedBorderColor") ?: namedColor("Button.focusedBorderColor")

            // Editor colors
            val editorScheme = EditorColorsManager.getInstance().globalScheme

            val editorBackground = editorScheme.defaultBackground
            val editorForeground = editorScheme.defaultForeground

            val findMatchBackground = editorScheme.getAttributes(EditorColors.SEARCH_RESULT_ATTRIBUTES)?.backgroundColor

            val findMatchSelectedBackground = namedColor("SearchMatch.selectedBackground") ?:
            editorScheme.getAttributes(EditorColors.SEARCH_RESULT_ATTRIBUTES)?.backgroundColor
            
            // These should match the keys in GUI's theme.ts
            val theme = mapOf(
                "background" to toHex(background),
                "foreground" to toHex(foreground),
                "editor-background" to toHex(editorBackground),
                "editor-foreground" to toHex(editorForeground),
                "primary-background" to toHex(buttonBackground),
                "primary-foreground" to toHex(buttonForeground),
                "primary-hover" to toHex(buttonHoverBackground),
                "secondary-background" to toHex(getSecondaryDark()),
                "secondary-foreground" to toHex(foreground),
                "secondary-hover" to toHex(hoverBackground),
                "border" to toHex(border),
                "border-focus" to toHex(focusBorder),
                "command-background" to toHex(commandBackground),
                "command-foreground" to toHex(commandForeground),
                "command-border" to toHex(border), // make command specific
                "command-border-focus" to toHex(focusBorder), // make command specific
                "description" to toHex(description),
                "description-muted" to toHex(mutedDescription),
                "input-background" to toHex(inputBackground),
                "input-foreground" to toHex(inputForeground),
                "input-border" to toHex(border),
                "input-placeholder" to toHex(inputPlaceholder),
                "table-oddRow" to toHex(hoverBackground),
                "badge-background" to toHex(badgeBackground),
                "badge-foreground" to toHex(badgeForeground),
                "success" to toHex(successColor),
                "warning" to toHex(warningColor),
                "error" to toHex(errorColor),
                "link" to toHex(link),
                "accent" to toHex(accentColor),
                "find-match" to toHex(findMatchBackground) + "40",
                "find-match-selected" to toHex(findMatchSelectedBackground),
                "list-hover" to toHex(listHoverBackground),
                "list-active" to toHex(actionHoverBackground) + "50",
                "list-active-foreground" to toHex(listSelectionForeground)
            )
            return theme
        } catch (error: Error) {
            return mapOf()
        }
    }
}