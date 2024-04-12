package com.github.continuedev.continueintellijextension.utils

import java.awt.Toolkit
import java.awt.event.KeyEvent

enum class Os {
    MAC, WINDOWS, LINUX
}
fun getOs(): Os {
    val osName = System.getProperty("os.name").toLowerCase()
    val os = when {
        osName.contains("mac") || osName.contains("darwin") -> Os.MAC
        osName.contains("win") -> Os.WINDOWS
        osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> Os.LINUX
        else -> Os.LINUX
    }
    return os
}

fun getMetaKeyLabel(): String {
    return when (getOs()) {
        Os.MAC -> "⌘"
        Os.WINDOWS -> "Ctrl"
        Os.LINUX -> "Ctrl"
    }
}

fun getAltKeyLabel(): String {
    return when (getOs()) {
        Os.MAC -> "⌥"
        Os.WINDOWS -> "Alt"
        Os.LINUX -> "Alt"
    }
}