package com.github.continuedev.continueintellijextension.proxy

import com.intellij.util.net.HttpConfigurable

data class ProxySettings(
    private val enabled: Boolean,
    private val proxy: String?,
    private val noProxy: String?
) {
    fun toContinueEnvVars(): Map<String, String> {
        if (!enabled)
            return emptyMap()
        val env = mutableMapOf<String, String>()
        proxy?.let { env["HTTP_PROXY"] = it }
        noProxy?.let { env["NO_PROXY"] = it }
        return env.filterValues { it.isNotBlank() }
    }

    companion object {
        fun getSettings(): ProxySettings {
            val settings = HttpConfigurable.getInstance()
            val validProxyOrNull =
                if (settings.PROXY_HOST != null && settings.PROXY_HOST.isNotBlank())
                    "${settings.PROXY_HOST}:${settings.PROXY_PORT}"
                else
                    null
            return ProxySettings(
                enabled = settings.USE_HTTP_PROXY,
                proxy = validProxyOrNull,
                noProxy = settings.PROXY_EXCEPTIONS
            )
        }
    }
}
