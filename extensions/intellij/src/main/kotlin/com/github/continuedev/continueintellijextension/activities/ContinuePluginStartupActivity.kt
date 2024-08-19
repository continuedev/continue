package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.auth.AuthListener
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.auth.ControlPlaneSessionInfo
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.services.SettingsListener
import com.github.continuedev.continueintellijextension.services.TelemetryService
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.KeyboardShortcut
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.keymap.KeymapManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.util.io.StreamUtil
import com.intellij.openapi.vfs.LocalFileSystem
import kotlinx.coroutines.*
import java.io.*
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Paths
import javax.swing.*
import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.components.service
import com.intellij.openapi.extensions.PluginId

fun showTutorial(project: Project) {
    ContinuePluginStartupActivity::class.java.getClassLoader().getResourceAsStream("continue_tutorial.py").use { `is` ->
        if (`is` == null) {
            throw IOException("Resource not found: continue_tutorial.py")
        }
        var content = StreamUtil.readText(`is`, StandardCharsets.UTF_8)
        if (!System.getProperty("os.name").toLowerCase().contains("mac")) {
            content = content.replace("⌘", "⌃")
        }
        val filepath = Paths.get(getContinueGlobalPath(), "continue_tutorial.py").toString()
        File(filepath).writeText(content)
        val virtualFile = LocalFileSystem.getInstance().findFileByPath(filepath)


        ApplicationManager.getApplication().invokeLater {
            if (virtualFile != null) {
                FileEditorManager.getInstance(project).openFile(virtualFile, true)
            }
        }
    }
}

class ContinuePluginStartupActivity : StartupActivity, Disposable, DumbAware {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    override fun runActivity(project: Project) {

        removeShortcutFromAction(getPlatformSpecificKeyStroke("J"))
        removeShortcutFromAction(getPlatformSpecificKeyStroke("shift J"))

       ApplicationManager.getApplication().executeOnPooledThread {
           initializePlugin(project)
       }
    }

    private fun getPlatformSpecificKeyStroke(key: String): String {
        val osName = System.getProperty("os.name").toLowerCase()
        val modifier = if (osName.contains("mac")) "meta" else "control"
        return "$modifier $key"
    }

    private fun removeShortcutFromAction(shortcut: String) {
        val keymap = KeymapManager.getInstance().activeKeymap
        val keyStroke = KeyStroke.getKeyStroke(shortcut)
        val actionIds = keymap.getActionIds(keyStroke)

        // If Continue has been re-assigned to another key, don't remove the shortcut
        if (!actionIds.any { it.startsWith("continue") }) {
            return
        }

        for (actionId in actionIds) {
             if (actionId.startsWith("continue")) {
                 continue
             }
             val shortcuts = keymap.getShortcuts(actionId)
             for (shortcut in shortcuts) {
                 if (shortcut is KeyboardShortcut && shortcut.firstKeyStroke == keyStroke) {
                     keymap.removeShortcut(actionId, shortcut)
                 }
             }
        }
    }

    private fun initializePlugin(project: Project) {
        val continuePluginService = ServiceManager.getService(
            project,
            ContinuePluginService::class.java
        )

        val defaultStrategy = DefaultTextSelectionStrategy()

        coroutineScope.launch {
            val settings =
                    ServiceManager.getService(ContinueExtensionSettings::class.java)
            if (!settings.continueState.shownWelcomeDialog) {
                settings.continueState.shownWelcomeDialog = true
                // Open continue_tutorial.py
                showTutorial(project)
            }

            val ideProtocolClient = IdeProtocolClient(
                    continuePluginService,
                    defaultStrategy,
                    coroutineScope,
                    project.basePath,
                    project
            )

            continuePluginService.ideProtocolClient = ideProtocolClient

            // Listen to changes to settings so the core can reload remote configuration
            val connection = ApplicationManager.getApplication().messageBus.connect()
            connection.subscribe(SettingsListener.TOPIC, object : SettingsListener {
                override fun settingsUpdated(settings: ContinueExtensionSettings.ContinueState) {
                    continuePluginService.coreMessenger?.request("config/ideSettingsUpdate", settings, null) { _ -> }
                }
            })

            // Listen for clicking settings button to start the auth flow
            val authService = service<ContinueAuthService>()
            val initialSessionInfo = authService.loadControlPlaneSessionInfo()

            if (initialSessionInfo != null) {
                val data = mapOf(
                        "sessionInfo" to initialSessionInfo
                )
                continuePluginService.coreMessenger?.request("didChangeControlPlaneSessionInfo", data, null) { _ -> }
                continuePluginService.sendToWebview("didChangeControlPlaneSessionInfo", data)
            }

            connection.subscribe(AuthListener.TOPIC, object : AuthListener {
                override fun startAuthFlow() {
                    authService.startAuthFlow(project)
                }

                override fun handleUpdatedSessionInfo(sessionInfo: ControlPlaneSessionInfo?) {
                    val data = mapOf(
                            "sessionInfo" to sessionInfo
                    )
                    continuePluginService.coreMessenger?.request("didChangeControlPlaneSessionInfo", data, null) { _ -> }
                    continuePluginService.sendToWebview("didChangeControlPlaneSessionInfo", data)
                }
            })

            GlobalScope.async(Dispatchers.IO) {
                val listener =
                        ContinuePluginSelectionListener(
                                ideProtocolClient,
                                coroutineScope
                        )

                // Reload the WebView
                continuePluginService?.let {
                    val workspacePaths =
                            if (project.basePath != null) arrayOf(project.basePath) else emptyList<String>()

                    continuePluginService.workspacePaths = workspacePaths as Array<String>
                }

                EditorFactory.getInstance().eventMulticaster.addSelectionListener(
                        listener,
                        this@ContinuePluginStartupActivity
                )
            }

            GlobalScope.async(Dispatchers.IO) {
                val myPluginId = "com.github.continuedev.continueintellijextension"
                val pluginDescriptor = PluginManager.getPlugin(PluginId.getId(myPluginId))

                if (pluginDescriptor == null) {
                    throw Exception("Plugin not found")
                }
                val pluginPath = pluginDescriptor.pluginPath
                val osName = System.getProperty("os.name").toLowerCase()
                val os = when {
                    osName.contains("mac") || osName.contains("darwin") -> "darwin"
                    osName.contains("win") -> "win32"
                    osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> "linux"
                    else -> "linux"
                }
                val osArch = System.getProperty("os.arch").toLowerCase()
                val arch = when {
                    osArch.contains("aarch64") || (osArch.contains("arm") && osArch.contains("64")) -> "arm64"
                    osArch.contains("amd64") || osArch.contains("x86_64") -> "x64"
                    else -> "x64"
                }
                val target = "$os-$arch"

                println("Identified OS: $os, Arch: $arch")

                val corePath = Paths.get(pluginPath.toString(), "core").toString()
                val targetPath = Paths.get(corePath, target).toString()
                val continueCorePath = Paths.get(targetPath, "continue-binary" + (if (os == "win32") ".exe" else "")).toString()

                // esbuild needs permissions
                val esbuildPath = Paths.get(targetPath, "esbuild"+ (if (os == "win32") ".exe" else "")).toString()

                val coreMessenger = CoreMessenger(project, esbuildPath, continueCorePath, ideProtocolClient)
                continuePluginService.coreMessenger = coreMessenger

                coreMessenger.request("config/getSerializedProfileInfo", null, null) { resp ->
                    val data = resp as? Map<String, Any>
                    val profileInfo = data?.get("config") as? Map<String, Any>
                    val allowAnonymousTelemetry = profileInfo?.get("allowAnonymousTelemetry") as? Boolean
                    val telemetryService = service<TelemetryService>()
                    if (allowAnonymousTelemetry == true || allowAnonymousTelemetry == null) {
                        telemetryService.setup(getMachineUniqueID())
                    }
                }
            }
        }
    }

    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}