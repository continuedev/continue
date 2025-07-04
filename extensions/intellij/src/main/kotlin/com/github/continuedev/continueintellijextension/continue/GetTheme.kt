package com.github.continuedev.continueintellijextension.`continue`

import com.intellij.openapi.editor.colors.EditorColors
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.colors.CodeInsightColors
import java.awt.Color
import kotlin.math.max
import kotlin.math.min
import com.intellij.ui.JBColor
import com.intellij.ui.ColorUtil
import kotlin.math.roundToInt

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

    fun lighten(color: Color, percentage: Int = 5): Color {
        // Increase each RGB component slightly
        val factor = 1 + percentage / 100f;
        fun lightenInt(value: Int): Int {
            return (value * factor).roundToInt().coerceAtMost(255)
        }
        return Color(
            lightenInt(color.red),
                    lightenInt (color.green),
            lightenInt(color.blue),
            color.alpha
        )
    }

    fun darken(color: Color, percentage: Int = 5): Color {
        // Decrease each RGB component slightly
        val factor = 1 - percentage / 100f;
        fun darkenInt(value: Int): Int {
            return (value * factor).roundToInt().coerceAtLeast(0)
        }
        return Color(
            darkenInt(color.red),
            darkenInt(color.green),
            darkenInt(color.blue),
            color.alpha
        )
    }

    fun slightChange(color: Color?, percentage: Int = 5): Color? {
        if(color == null){
            return null
        }
        // If dark, make slightly lighter. If light, make slightly darker
        val averageRgb = (color.red + color.green + color.blue) / 3
        return if (averageRgb > 128) darken(color, percentage) else lighten(color, percentage)
    }

    fun getTheme(): Map<String, String?> {
        try {
            val editorScheme = EditorColorsManager.getInstance().globalScheme

            val background = JBColor.background()
            val foreground = JBColor.foreground()

            val border = JBColor.border()
            val focusBorder = namedColor("Focus.borderColor") ?: namedColor("Component.focusedBorderColor")

            val buttonBackground = namedColor("Button.default.startBackground")
                ?: namedColor("Button.default.background")

            val buttonForeground = namedColor("Button.default.startForeground")
                ?: namedColor("Button.default.foreground")

            val buttonHoverBackground = namedColor("Button.default.hoverStartBackground")
                ?: namedColor("Button.default.hoverBackground")
                ?: namedColor("Button.default.startHoverBackground")
                ?: slightChange(buttonBackground)

            val secondaryBackground = namedColor("Button.background") ?: background
            val secondaryHoverBackground = namedColor("Button.hoverBackground") ?: slightChange(secondaryBackground)

            val badgeBackground = namedColor("Badge.background")
            val badgeForeground = namedColor("Badge.foreground")

            val commandBackground = namedColor("CommandButton.background") ?: namedColor("ToolWindow.background")
            val commandForeground = namedColor("CommandButton.foreground") ?: namedColor("ToolWindow.foreground")

            val inputBackground = namedColor("TextField.background")
            val inputForeground = namedColor("TextField.foreground")
            val inputPlaceholder = namedColor("TextField.inactiveForeground")

            val listHoverBackground = namedColor("List.hoverBackground") ?: slightChange(background)
            val listHoverForeground = namedColor("List.hoverForeground") ?: slightChange(foreground)

            val tableOddRow = namedColor("Table.hoverBackground") ?: namedColor("Table.stripeColor")

            val description = namedColor("Label.infoForeground") ?: namedColor("Label.disabledForeground") ?: foreground

            val mutedDescription = namedColor("Component.infoForeground")
                ?: namedColor("ContextHelp.foreground")
                ?: namedColor("TextField.placeholderForeground")
                ?: namedColor("Label.disabledForeground")
                ?: namedColor("ToolTip.foreground")
                ?: description

            val link = namedColor("Link.activeForeground")

            val successColor = namedColor("ValidationSuccess.successColor")
                ?: namedColor("Component.successForeground")
                ?: namedColor("Label.successForeground")
            val warningColor = namedColor("ValidationWarning.warningColor")
                ?: EditorColorsManager.getInstance().globalScheme.getAttributes(CodeInsightColors.WARNINGS_ATTRIBUTES)?.effectColor
                ?: namedColor("Component.warningForeground")
                ?: namedColor("Label.warningForeground")
            val errorColor = namedColor("ValidationError.errorColor") ?: namedColor("Component.errorForeground") ?: namedColor("Label.errorForeground")

            val accentColor = namedColor("Focus.defaultButtonBorderColor") ?: namedColor("Button.default.focusedBorderColor") ?: namedColor("Button.focusedBorderColor")

            val editorBackground = editorScheme.defaultBackground
            val editorForeground = editorScheme.defaultForeground

            val findMatchBackground = editorScheme.getAttributes(EditorColors.SEARCH_RESULT_ATTRIBUTES)?.backgroundColor

            val findMatchSelectedBackground = namedColor("SearchMatch.selectedBackground") ?:
            editorScheme.getAttributes(EditorColors.SEARCH_RESULT_ATTRIBUTES)?.backgroundColor
            
            // Use editor background with slight tint for code blocks
            val textCodeBlockBackground = slightChange(editorBackground, 3) ?: editorBackground

            // These should match the keys in GUI's theme.ts
            val theme = mapOf(
                "background" to background,
                "foreground" to foreground,
                "editor-background" to editorBackground,
                "editor-foreground" to editorForeground,
                "primary-background" to buttonBackground,
                "primary-foreground" to buttonForeground,
                "primary-hover" to buttonHoverBackground,
                "secondary-background" to secondaryBackground,
                "secondary-foreground" to foreground,
                "secondary-hover" to secondaryHoverBackground,
                "border" to border,
                "border-focus" to focusBorder,
                "command-background" to commandBackground,
                "command-foreground" to commandForeground,
                "command-border" to border,
                "command-border-focus" to focusBorder,
                "description" to description,
                "description-muted" to mutedDescription,
                "input-background" to inputBackground,
                "input-foreground" to inputForeground,
                "input-border" to border,
                "input-placeholder" to inputPlaceholder,
                "table-oddRow" to tableOddRow,
                "badge-background" to badgeBackground,
                "badge-foreground" to badgeForeground,
                "success" to successColor,
                "warning" to warningColor,
                "error" to errorColor,
                "link" to link,
                "textCodeBlockBackground" to textCodeBlockBackground,
                "accent" to accentColor,
                "find-match" to findMatchBackground,
                "find-match-selected" to findMatchSelectedBackground,
                "list-hover" to listHoverBackground,
                "list-active" to listHoverBackground,
                "list-active-foreground" to listHoverForeground
            ).mapValues { toHex(it.value) }
            return theme
        } catch (error: Error) {
            return mapOf()
        }
    }
}