package com.github.continuedev.continueintellijextension.actions


import com.intellij.openapi.actionSystem.ActionPromoter
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.DataContext
import org.jetbrains.annotations.NotNull

class ContinueActionPromote : ActionPromoter {

    override fun promote(@NotNull actions: List<AnAction>, @NotNull context: DataContext): List<AnAction>? {
        val rejectDiffActions = actions.filterIsInstance<RejectDiffAction>()
        if (rejectDiffActions.isNotEmpty()) {
            return rejectDiffActions
        }

        return null
    }
}