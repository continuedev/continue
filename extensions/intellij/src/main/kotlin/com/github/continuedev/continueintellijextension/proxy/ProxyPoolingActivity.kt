package com.github.continuedev.continueintellijextension.proxy

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import kotlinx.coroutines.*
import kotlin.time.Duration.Companion.seconds

class ProxyPoolingActivity : ProjectActivity {
    private var lastSettings = ProxySettings.getSettings()
    private val scope = CoroutineScope(Dispatchers.Default)

    override suspend fun execute(project: Project) {
        scope.launch {
            while (isActive) {
                val newSettings = ProxySettings.getSettings()
                if (newSettings != lastSettings) {
                    onSettingsChanged(project)
                    lastSettings = newSettings
                }
                delay(2.seconds)
            }
        }
    }

    private fun onSettingsChanged(project: Project) {
        LOG.warn("Proxy settings changed, restarting")
        project.service<ContinuePluginService>().coreMessengerManager?.coreMessenger?.restart()
    }

    private companion object {
        private val LOG = Logger.getInstance(ProxyPoolingActivity::class.java.simpleName)
    }
}



