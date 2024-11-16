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
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.KeyboardShortcut
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ApplicationNamesInfo
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
import java.nio.file.Paths
import javax.swing.*
import com.intellij.openapi.components.service
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.roots.ModuleRootManager
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.vfs.newvfs.events.VFileDeleteEvent
import com.intellij.openapi.vfs.newvfs.events.VFileContentChangeEvent

fun showTutorial(project: Project) {
    val tutorialFileName = getTutorialFileName()

    ContinuePluginStartupActivity::class.java.getClassLoader().getResourceAsStream(tutorialFileName)
        .use { `is` ->
            if (`is` == null) {
                throw IOException("Resource not found: $tutorialFileName")
            }
            var content = StreamUtil.readText(`is`, StandardCharsets.UTF_8)
            if (!System.getProperty("os.name").lowercase().contains("mac")) {
                content = content.replace("⌘", "⌃")
            }
            val filepath = Paths.get(getContinueGlobalPath(), tutorialFileName).toString()
            File(filepath).writeText(content)
            val virtualFile = LocalFileSystem.getInstance().findFileByPath(filepath)

            ApplicationManager.getApplication().invokeLater {
                if (virtualFile != null) {
                    FileEditorManager.getInstance(project).openFile(virtualFile, true)
                }
            }
        }
}

private fun getTutorialFileName(): String {
    val appName = ApplicationNamesInfo.getInstance().fullProductName.lowercase()
    return when {
        appName.contains("intellij") -> "continue_tutorial.java"
        appName.contains("pycharm") -> "continue_tutorial.py"
        appName.contains("webstorm") -> "continue_tutorial.ts"
        else -> "continue_tutorial.py" // Default to Python tutorial
    }
}

class ContinuePluginStartupActivity : StartupActivity, DumbAware {

    override fun runActivity(project: Project) {
        removeShortcutFromAction(getPlatformSpecificKeyStroke("J"))
        removeShortcutFromAction(getPlatformSpecificKeyStroke("shift J"))
        removeShortcutFromAction(getPlatformSpecificKeyStroke("I"))
        initializePlugin(project)
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
        val coroutineScope = CoroutineScope(Dispatchers.IO)
        val continuePluginService = ServiceManager.getService(
            project,
            ContinuePluginService::class.java
        )

        coroutineScope.launch {
            val settings =
                ServiceManager.getService(ContinueExtensionSettings::class.java)
            if (!settings.continueState.shownWelcomeDialog) {
                settings.continueState.shownWelcomeDialog = true
                // Open tutorial file
                showTutorial(project)
            }

            settings.addRemoteSyncJob()

            val ideProtocolClient = IdeProtocolClient(
                continuePluginService,
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
                    continuePluginService.sendToWebview(
                        "didChangeIdeSettings", mapOf(
                            "settings" to mapOf(
                                "remoteConfigServerUrl" to settings.remoteConfigServerUrl,
                                "remoteConfigSyncPeriod" to settings.remoteConfigSyncPeriod,
                                "userToken" to settings.userToken,
                                "enableControlServerBeta" to settings.enableContinueTeamsBeta
                            )
                        )
                    )
                }
            })

            // Handle file changes and deletions - reindex
            connection.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    // Collect all relevant paths for deletions
                    val deletedPaths = events.filterIsInstance<VFileDeleteEvent>()
                        .map { event -> event.file.path.split("/").dropLast(1).joinToString("/") }

                    // Collect all relevant paths for content changes
                    val changedPaths = events.filterIsInstance<VFileContentChangeEvent>()
                        .map { event -> event.file.path.split("/").dropLast(1).joinToString("/") }

                    // Combine both lists of paths for re-indexing
                    val allPaths = deletedPaths + changedPaths

                    // Create a data map if there are any paths to re-index
                    if (allPaths.isNotEmpty()) {
                        val data = mapOf("files" to allPaths)
                        continuePluginService.coreMessenger?.request("index/forceReIndexFiles", data, null) { _ -> }
                    }
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
                    continuePluginService.coreMessenger?.request(
                        "didChangeControlPlaneSessionInfo",
                        data,
                        null
                    ) { _ -> }
                    continuePluginService.sendToWebview("didChangeControlPlaneSessionInfo", data)
                }
            })

            val listener =
                ContinuePluginSelectionListener(
                    coroutineScope,
                )

            // Reload the WebView
            continuePluginService?.let { pluginService ->
                val allModulePaths = ModuleManager.getInstance(project).modules
                    .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.map { it.path } }
                    .map { Paths.get(it).normalize() }

                val topLevelModulePaths = allModulePaths
                    .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }
                    .map { it.toString() }

                pluginService.workspacePaths = topLevelModulePaths.toTypedArray()
            }

            EditorFactory.getInstance().eventMulticaster.addSelectionListener(
                listener,
                ContinuePluginDisposable.getInstance(project)
            )

            val coreMessengerManager = CoreMessengerManager(project, ideProtocolClient, coroutineScope)
            continuePluginService.coreMessengerManager = coreMessengerManager
        }
    }
}