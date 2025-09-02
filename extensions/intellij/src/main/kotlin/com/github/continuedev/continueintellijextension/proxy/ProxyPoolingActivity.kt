package com.github.continuedev.continueintellijextension.proxy

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import kotlinx.coroutines.*
import kotlin.time.Duration.Companion.seconds

class ProxyPoolingActivity : StartupActivity {
    private val scope = CoroutineScope(Dispatchers.Default)
    private var lastSettings = ProxySettings.getSettings()
    private val log = Logger.getInstance(ProxyPoolingActivity::class.java)

    override fun runActivity(project: Project) {
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
        log.warn("Proxy settings changed, restarting")
        project.service<ContinuePluginService>().coreMessengerManager?.coreMessenger?.restart()
    }
}



