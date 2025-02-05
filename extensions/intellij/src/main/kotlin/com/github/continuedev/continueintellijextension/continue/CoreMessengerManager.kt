package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.TelemetryService
import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.components.service
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import java.nio.file.Paths
import kotlinx.coroutines.*

class CoreMessengerManager(
    private val project: Project,
    private val ideProtocolClient: IdeProtocolClient,
    private val coroutineScope: CoroutineScope
) {

    var coreMessenger: CoreMessenger? = null
    private var lastBackoffInterval = 0.5

    init {
        coroutineScope.launch {
            val myPluginId = "com.github.continuedev.continueintellijextension"
            val pluginDescriptor =
                PluginManager.getPlugin(PluginId.getId(myPluginId)) ?: throw Exception("Plugin not found")

            val pluginPath = pluginDescriptor.pluginPath
            val osName = System.getProperty("os.name").toLowerCase()
            val os =
                when {
                    osName.contains("mac") || osName.contains("darwin") -> "darwin"
                    osName.contains("win") -> "win32"
                    osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> "linux"
                    else -> "linux"
                }
            val osArch = System.getProperty("os.arch").toLowerCase()
            val arch =
                when {
                    osArch.contains("aarch64") || (osArch.contains("arm") && osArch.contains("64")) ->
                        "arm64"

                    osArch.contains("amd64") || osArch.contains("x86_64") -> "x64"
                    else -> "x64"
                }
            val target = "$os-$arch"

            println("Identified OS: $os, Arch: $arch")

            val corePath = Paths.get(pluginPath.toString(), "core").toString()
            val targetPath = Paths.get(corePath, target).toString()
            val continueCorePath =
                Paths.get(targetPath, "continue-binary" + (if (os == "win32") ".exe" else "")).toString()

            setupCoreMessenger(continueCorePath)
        }
    }

    private fun setupCoreMessenger(continueCorePath: String) {
        coreMessenger = CoreMessenger(project, continueCorePath, ideProtocolClient, coroutineScope)

        coreMessenger?.request("config/getSerializedProfileInfo", null, null) { response ->
            val responseObject = response as Map<*, *>
            val responseContent = responseObject["content"] as Map<*, *>
            val result = responseContent["result"] as Map<*, *>
            val config = result["config"] as Map<String, Any>

            val allowAnonymousTelemetry = config?.get("allowAnonymousTelemetry") as? Boolean
            val telemetryService = service<TelemetryService>()
            if (allowAnonymousTelemetry == true || allowAnonymousTelemetry == null) {
                telemetryService.setup(getMachineUniqueID())
            }
        }

        // On exit, use exponential backoff to create another CoreMessenger
        coreMessenger?.onDidExit {
            lastBackoffInterval *= 2
            println("CoreMessenger exited, retrying in $lastBackoffInterval seconds")
            Thread.sleep((lastBackoffInterval * 1000).toLong())
            setupCoreMessenger(continueCorePath)
        }
    }
}
