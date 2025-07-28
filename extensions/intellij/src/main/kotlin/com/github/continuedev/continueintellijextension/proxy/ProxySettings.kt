package com.github.continuedev.continueintellijextension.proxy

import com.intellij.util.net.HttpConfigurable

data class ProxySettings(
    val enabled: Boolean,
    val proxy: String,
) {

    companion object {
        fun getSettings(): ProxySettings {
            val settings = HttpConfigurable.getInstance()
            return ProxySettings(
                enabled = settings.USE_HTTP_PROXY,
                proxy = "${settings.PROXY_HOST}:${settings.PROXY_PORT}"
            )
        }
    }

}
