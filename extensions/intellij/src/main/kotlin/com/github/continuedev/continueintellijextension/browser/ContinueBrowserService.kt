package com.github.continuedev.continueintellijextension.browser

import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.JBCefApp

@Service(Service.Level.PROJECT)
class ContinueBrowserService(project: Project) {

    private val browser: ContinueBrowser? =
        if (JBCefApp.isSupported())
            ContinueBrowser(project)
        else null

    companion object {

        fun Project.getBrowser() =
            service<ContinueBrowserService>().browser

    }
}
