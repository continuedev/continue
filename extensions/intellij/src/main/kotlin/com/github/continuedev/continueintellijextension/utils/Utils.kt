package com.github.continuedev.continueintellijextension.utils

import com.github.continuedev.continueintellijextension.FimResult
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
 * Get the target string for Continue binary.
 * The format is "$os-$arch" where:
 * - os is one of: darwin, win32, or linux
 * - arch is one of: arm64 or x64
 *
 * @return Target string in format "$os-$arch"
 */
fun getOsAndArchTarget(): String {
    val os = getOS()
    val osStr = when (os) {
        OS.MAC -> "darwin"
        OS.WINDOWS -> "win32"
        OS.LINUX -> "linux"
    }

    val osArch = System.getProperty("os.arch").lowercase()
    val arch = when {
        osArch.contains("aarch64") || (osArch.contains("arm") && osArch.contains("64")) -> "arm64"
        osArch.contains("amd64") || osArch.contains("x86_64") -> "x64"
        else -> "x64"
    }

    return "$osStr-$arch"
}

/**
 * Check if the diff is indeed a FIM (Fill-In-Middle).
 * @param oldEditRange Original string content.
 * @param newEditRange New string content.
 * @param cursorPosition The position of the cursor in the old string.
 * @return A Pair where the first value is a boolean indicating if the change is purely additive (FIM)
 *         and the second value is the FIM text content or null if not a FIM.
 */
fun checkFim(
    oldEditRange: String,
    newEditRange: String,
    cursorPosition: Pair<Int, Int> // line, character
): FimResult {
    // Find the common prefix
    var prefixLength = 0
    while (prefixLength < oldEditRange.length &&
        prefixLength < newEditRange.length &&
        oldEditRange[prefixLength] == newEditRange[prefixLength]) {
        prefixLength++
    }

    // Find the common suffix
    var oldSuffixPos = oldEditRange.length - 1
    var newSuffixPos = newEditRange.length - 1

    while (oldSuffixPos >= prefixLength &&
        newSuffixPos >= prefixLength &&
        oldEditRange[oldSuffixPos] == newEditRange[newSuffixPos]) {
        oldSuffixPos--
        newSuffixPos--
    }

    // The old text is purely preserved if:
    // 1. The prefix ends before or at the cursor.
    // 2. The suffix starts after or at the cursor.
    // 3. There's no gap between prefix and suffix in the old text.

    val suffixStartInOld = oldSuffixPos + 1
    val suffixStartInNew = newSuffixPos + 1

    // Convert cursor position to an offset in the string.
    // For simplicity, we need to calculate the cursor's position in the string.
    // This requires knowledge of line endings in the oldEditRange.
    val lines = oldEditRange.substring(0, prefixLength).split("\n")
    val cursorOffset = if (lines.size > 1) {
        lines.dropLast(1).sumOf { it.length + 1 } + cursorPosition.second
    } else {
        cursorPosition.second
    }

    // Check if the cursor is positioned between the prefix and suffix.
    val cursorBetweenPrefixAndSuffix =
        prefixLength <= cursorOffset && cursorOffset <= suffixStartInOld

    // Check if the old text is completely preserved (no deletion).
    val noTextDeleted = suffixStartInOld - prefixLength <= 0

    val isFim = cursorBetweenPrefixAndSuffix && noTextDeleted

    return if (isFim) {
        // Extract the content between prefix and suffix in the new string.
        FimResult.FimEdit(newEditRange.substring(prefixLength, suffixStartInNew))
    } else {
        FimResult.NotFimEdit
    }
}