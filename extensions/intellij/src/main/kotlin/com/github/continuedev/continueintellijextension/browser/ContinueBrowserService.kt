package com.github.continuedev.continueintellijextension.browser

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp

@Service(Service.Level.PROJECT)
class ContinueBrowserService(project: Project): Disposable {

    private val browser: ContinueBrowser? =
        if (JBCefApp.isSupported())
            ContinueBrowser(project)
        else null

    override fun dispose() {
        if (browser != null)
            Disposer.dispose(browser)
    }

    companion object {

        fun Project.getBrowser(): ContinueBrowser? {
            if (isDisposed)
                return null
            return service<ContinueBrowserService>().browser
        }

    }
}
