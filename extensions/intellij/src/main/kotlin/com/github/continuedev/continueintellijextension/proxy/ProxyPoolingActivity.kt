package com.github.continuedev.continueintellijextension.proxy

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.application.EDT
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.util.net.HttpConfigurable
import kotlinx.coroutines.*
import kotlin.time.Duration.Companion.seconds

class ProxyPoolingActivity : StartupActivity {
    private val edtScope = CoroutineScope(Dispatchers.EDT)
    private var lastSettings = readSettings()

    override fun runActivity(project: Project) {
        sendSettings(project, lastSettings)

        // note: polling is the only option because there is no message bus topic for proxy settings
        edtScope.launch {
            while (isActive) {
                val newSettings = readSettings()
                if (newSettings != lastSettings) {
                    sendSettings(project, newSettings)
                    lastSettings = newSettings
                }
                delay(2.seconds)
            }
        }
    }

    private fun readSettings(): ProxySettings {
        val settings = HttpConfigurable.getInstance()
        return ProxySettings(
            enabled = settings.USE_HTTP_PROXY,
            proxy = "${settings.PROXY_HOST}:${settings.PROXY_PORT}",
            noProxy = settings.PROXY_EXCEPTIONS.split(",")
        )
    }

    private fun sendSettings(project: Project, settings: ProxySettings) =
        project.service<ContinuePluginService>().coreMessenger?.request("config/ideProxySettings", settings, null) {}
}

