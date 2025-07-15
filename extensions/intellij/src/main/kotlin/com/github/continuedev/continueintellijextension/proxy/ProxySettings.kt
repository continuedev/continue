package com.github.continuedev.continueintellijextension.proxy

data class ProxySettings(
    val enabled: Boolean,
    val proxy: String,
    // todo: val noProxy: List<String>
)
