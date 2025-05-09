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

inline fun <reified T> Any?.castNestedOrNull(vararg keys: String): T? {
    return getNestedOrNull(*keys) as? T
}

fun Any?.getNestedOrNull(vararg keys: String): Any? {
    var result = this
    for (key in keys) {
        result = (result as? Map<*, *>)?.get(key) ?: return null
    }
    return result
}

/**
 * Get the OS and architecture as a string pair formatted for Continue binary.
 * The format is "$os-$arch" where:
 * - os is one of: darwin, win32, or linux
 * - arch is one of: arm64 or x64
 *
 * @return Triple of OS string, architecture string, and combined target string
 */
fun getOsAndArch(): Triple<String, String, String> {
    val osName = System.getProperty("os.name").lowercase()
    val os = when {
        osName.contains("mac") || osName.contains("darwin") -> "darwin"
        osName.contains("win") -> "win32"
        osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> "linux"
        else -> "linux"
    }

    val osArch = System.getProperty("os.arch").lowercase()
    val arch = when {
        osArch.contains("aarch64") || (osArch.contains("arm") && osArch.contains("64")) -> "arm64"
        osArch.contains("amd64") || osArch.contains("x86_64") -> "x64"
        else -> "x64"
    }

    val target = "$os-$arch"

    return Triple(os, arch, target)
}