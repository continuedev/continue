package com.github.continuedev.continueintellijextension.utils

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.extensions.PluginId
import com.github.continuedev.continueintellijextension.constants.ContinueConstants
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Gets the path to the Continue plugin directory
 *
 * @return Path to the plugin directory
 * @throws Exception if the plugin is not found
 */
fun getContinuePluginPath(): Path {
    val pluginDescriptor =
        PluginManagerCore.getPlugin(PluginId.getId(ContinueConstants.PLUGIN_ID)) ?: throw Exception("Plugin not found")
    return pluginDescriptor.pluginPath
}

/**
 * Gets the path to the Continue core directory with target platform
 *
 * @return Path to the Continue core directory with target platform
 * @throws Exception if the plugin is not found
 */
fun getContinueCorePath(): String {
    val pluginPath = getContinuePluginPath()
    val corePath = Paths.get(pluginPath.toString(), "core").toString()
    val target = getOsAndArchTarget()
    return Paths.get(corePath, target).toString()
}

/**
 * Gets the path to the Continue binary executable
 *
 * @return Path to the Continue binary executable
 * @throws Exception if the plugin is not found
 */
fun getContinueBinaryPath(): String {
    val targetPath = getContinueCorePath()
    val os = getOS()
    val exeSuffix = if (os == OS.WINDOWS) ".exe" else ""
    return Paths.get(targetPath, "continue-binary$exeSuffix").toString()
}

/**
 * Gets the path to the Ripgrep executable
 *
 * @return Path to the Ripgrep executable
 * @throws Exception if the plugin is not found
 */
fun getRipgrepPath(): String {
    val targetPath = getContinueCorePath()
    val os = getOS()
    val exeSuffix = if (os == OS.WINDOWS) ".exe" else ""
    return Paths.get(targetPath, "rg$exeSuffix").toString()
}