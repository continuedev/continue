package com.github.continuedev.continueintellijextension.autocomplete

import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.DefaultActionGroup
import com.intellij.openapi.components.service

class AutocompleteActionGroup : DefaultActionGroup() {
    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.EDT
    }

    override fun update(e: AnActionEvent) {
        super.update(e)
        removeAll()

        val continueSettingsService = service<ContinueExtensionSettings>()
        if (continueSettingsService.continueState.enableTabAutocomplete) {
            addAll(
                DisableTabAutocompleteAction(),
            )
        } else {
            addAll(
                EnableTabAutocompleteAction(),
            )
        }
    }
}