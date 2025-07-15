package com.github.continuedev.continueintellijextension.proxy

data class ProxySettings(
    val enabled: Boolean,
    val proxy: String,
    val noProxy: List<String>
)
