package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.proxy.ProxySettings
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.util.net.HttpConfigurable

class ProxySettingsTest : BasePlatformTestCase() {

    fun `test enabled proxy config`() {
        HttpConfigurable.getInstance().apply {
            USE_HTTP_PROXY = true
            PROXY_HOST = "127.0.0.1"
            PROXY_PORT = 80
            PROXY_EXCEPTIONS = "*.example.com, 192.168.*"
        }
        val settingsMap = ProxySettings.getSettings().toContinueEnvVars()
        assertEquals(
            mapOf(
                "HTTP_PROXY" to "127.0.0.1:80",
                "NO_PROXY" to "*.example.com, 192.168.*"
            ), settingsMap
        )
    }

    fun `test disabled proxy ignores other settings`() {
        HttpConfigurable.getInstance().apply {
            USE_HTTP_PROXY = false
            PROXY_HOST = "127.0.0.1"
            PROXY_PORT = 80
            PROXY_EXCEPTIONS = "*.example.com, 192.168.*"
        }
        val settingsMap = ProxySettings.getSettings().toContinueEnvVars()
        assertEquals(emptyMap<String, String>(), settingsMap)
    }

    fun `test enabled proxy config with null values`() {
        HttpConfigurable.getInstance().apply {
            USE_HTTP_PROXY = true
            PROXY_HOST = null
            PROXY_PORT = 80
            PROXY_EXCEPTIONS = null
        }
        val settingsMap = ProxySettings.getSettings().toContinueEnvVars()
        assertEquals(emptyMap<String, String>(), settingsMap)
    }

    fun `test enabled proxy config with blank values`() {
        HttpConfigurable.getInstance().apply {
            USE_HTTP_PROXY = true
            PROXY_HOST = ""
            PROXY_PORT = 80
            PROXY_EXCEPTIONS = ""
        }
        val settingsMap = ProxySettings.getSettings().toContinueEnvVars()
        assertEquals(emptyMap<String, String>(), settingsMap)
    }

}
