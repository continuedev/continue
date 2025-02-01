package com.github.continuedev.continueintellijextension.autocomplete

import com.intellij.codeInsight.lookup.impl.LookupImpl
import com.intellij.codeInsight.lookup.Lookup
import com.intellij.codeInsight.lookup.LookupEvent
import com.intellij.codeInsight.lookup.LookupListener
import com.intellij.codeInsight.lookup.LookupManagerListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import java.util.concurrent.atomic.AtomicBoolean

@Service(Service.Level.PROJECT)
class AutocompleteLookupListener(project: Project) : LookupManagerListener {
    private val isLookupShown = AtomicBoolean(true)
    
    fun isLookupEmpty(): Boolean {
        return isLookupShown.get()
    }

    init {
        project.messageBus.connect().subscribe(LookupManagerListener.TOPIC, this)
    }

    override fun activeLookupChanged(oldLookup: Lookup?, newLookup: Lookup?) {
        val newEditor = newLookup?.editor ?: return
        if (newLookup is LookupImpl) {
            newLookup.addLookupListener(
                object : LookupListener {
                    override fun lookupShown(event: LookupEvent) {
                        isLookupShown.set(false)
                        ApplicationManager.getApplication().invokeLater {
                            event.lookup.editor.project?.service<AutocompleteService>()?.hideCompletions(newEditor)
                        }
                    }

                    override fun lookupCanceled(event: LookupEvent) {
                        isLookupShown.set(true)
                    }

                    override fun itemSelected(event: LookupEvent) {
                        isLookupShown.set(true)
                    }
                })
        }
    }
}