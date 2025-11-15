package com.github.continuedev.continueintellijextension.browser

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp

@Service(Service.Level.PROJECT)
class ContinueBrowserService(val project: Project): Disposable {

    private var browser: ContinueBrowser? = null

    init {
        load()
    }

    override fun dispose() {
        browser?.let { Disposer.dispose(it) }
        browser = null
    }

    private fun load(): ContinueBrowser? {
        if (browser != null) {
            return browser
        }
        if (!JBCefApp.isSupported()) {
            return null
        }
        val newBrowser = ContinueBrowser(project)
        Disposer.register(this, newBrowser)

        this.browser = newBrowser
        return this.browser
    }

    /**
     * Reloads the browser by disposing the current one and creating a new one.
     * This method is intended for use when browser is frozen (unresponsive).
     */
    fun reload() {
        browser?.let {
            Disposer.dispose(it)
        }
        browser = null

        load()
    }

    companion object {

        fun Project.getBrowser(): ContinueBrowser? {
            if (isDisposed)
                return null
            return service<ContinueBrowserService>().browser
        }

    }
}
