package com.github.continuedev.continueintellijextension.utils

import org.jetbrains.plugins.terminal.TerminalView
import java.awt.Toolkit
import java.awt.event.KeyEvent
import java.nio.file.Path
import java.nio.file.Paths

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

fun TerminalView.isNotAvailable(): Boolean =
    toolWindow == null || !toolWindow.isVisible || !toolWindow.isAvailable || toolWindow.isDisposed

// Should be in sync with core/util/paths.ts
fun getContinueGlobalDir(): Path {
    val envGlobalDir = System.getenv("CONTINUE_GLOBAL_DIR")
    if (envGlobalDir != null) {
        return Paths.get(envGlobalDir)
    }

    val defaultDotDir = Paths.get(System.getProperty("user.home"), ".continue")

    // Backwards compatibility: use ~/.continue if it already exists
    if (defaultDotDir.toFile().exists()) {
        return defaultDotDir
    }

    // on Linux, prefer XDG directories by default
    // https://specifications.freedesktop.org/basedir-spec/latest/index.html
    val xdgDataDir = System.getenv("XDG_DATA_HOME")
    if (xdgDataDir != null) {
        return Paths.get(xdgDataDir, "Continue")
    }

    // on Windows, prefer ~\AppData\Local
    val localAppDataDir = System.getenv("LOCALAPPDATA")
    if (localAppDataDir != null) {
        return Paths.get(localAppDataDir, "Continue")
    }

    // Use ~/.continue everywhere else.
    return defaultDotDir
}
