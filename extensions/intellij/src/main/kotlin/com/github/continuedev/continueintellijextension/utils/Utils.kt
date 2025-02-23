package com.github.continuedev.continueintellijextension.utils

import com.intellij.openapi.vfs.VirtualFile
import java.net.NetworkInterface
import java.util.*
import java.awt.event.KeyEvent.*

enum class OS {
    MAC, WINDOWS, LINUX
}

fun getMetaKey(): Int {
    return when (getOS()) {
        OS.MAC -> VK_META
        OS.WINDOWS -> VK_CONTROL
        OS.LINUX -> VK_CONTROL
    }
}

fun getOS(): OS {
    val osName = System.getProperty("os.name").lowercase()
    val os = when {
        osName.contains("mac") || osName.contains("darwin") -> OS.MAC
        osName.contains("win") -> OS.WINDOWS
        osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> OS.LINUX
        else -> OS.LINUX
    }
    return os
}

fun getMetaKeyLabel(): String {
    return when (getOS()) {
        OS.MAC -> "⌘"
        OS.WINDOWS -> "^"
        OS.LINUX -> "^"
    }
}

fun getAltKeyLabel(): String {
    return when (getOS()) {
        OS.MAC -> "⌥"
        OS.WINDOWS -> "Alt"
        OS.LINUX -> "Alt"
    }
}

fun getShiftKeyLabel(): String {
    return when (getOS()) {
        OS.MAC -> "⇧"
        OS.WINDOWS, OS.LINUX -> "↑"
    }
}

fun getMachineUniqueID(): String {
    val sb = StringBuilder()
    val networkInterfaces = NetworkInterface.getNetworkInterfaces()

    while (networkInterfaces.hasMoreElements()) {
        val networkInterface = networkInterfaces.nextElement()
        val mac = networkInterface.hardwareAddress

        if (mac != null) {
            for (i in mac.indices) {
                sb.append(
                    String.format(
                        "%02X%s",
                        mac[i],
                        if (i < mac.size - 1) "-" else ""
                    )
                )
            }
            return sb.toString()
        }
    }

    return "No MAC Address Found"
}

fun uuid(): String {
    return UUID.randomUUID().toString()
}

fun VirtualFile.toUriOrNull(): String? = fileSystem.getNioPath(this)?.toUri()?.toString()?.removeSuffix("/")