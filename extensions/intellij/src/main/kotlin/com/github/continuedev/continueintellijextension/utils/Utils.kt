package com.github.continuedev.continueintellijextension.utils

import java.net.NetworkInterface
import java.util.*

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
        Os.WINDOWS -> "^"
        Os.LINUX -> "^"
    }
}

fun getAltKeyLabel(): String {
    return when (getOs()) {
        Os.MAC -> "⌥"
        Os.WINDOWS -> "Alt"
        Os.LINUX -> "Alt"
    }
}

fun getShiftKeyLabel(): String {
    return when (getOs()) {
        Os.MAC -> "⇧"
        Os.WINDOWS, Os.LINUX -> "↑"
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