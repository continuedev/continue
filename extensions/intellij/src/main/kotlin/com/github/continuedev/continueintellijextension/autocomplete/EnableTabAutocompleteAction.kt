package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
class EnableTabAutocompleteAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val continueSettingsService = service<ContinueExtensionSettings>()
        continueSettingsService.continueState.enableTabAutocomplete = true
    }
}
