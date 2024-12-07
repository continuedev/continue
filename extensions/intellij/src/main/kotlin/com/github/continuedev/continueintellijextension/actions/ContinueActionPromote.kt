package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.autocomplete.AcceptAutocompleteAction
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.intellij.openapi.actionSystem.ActionPromoter
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.components.ServiceManager
import org.jetbrains.annotations.NotNull

class ContinueActionPromote : ActionPromoter {

    override fun promote(@NotNull actions: List<AnAction>, @NotNull context: DataContext): List<AnAction>? {

        if (actions.none { it is AcceptAutocompleteAction }) {
            return null
        } else {
            val settings = ServiceManager.getService(ContinueExtensionSettings::class.java)
            if (!settings.continueState.showIDECompletionSideBySide) {
                return null;
            }
            return actions.filterIsInstance<AcceptAutocompleteAction>()
        }
    }
}