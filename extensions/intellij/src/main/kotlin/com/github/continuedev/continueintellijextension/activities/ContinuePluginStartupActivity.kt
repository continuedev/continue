package com.github.continuedev.continueintellijextension.activities

import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.github.continuedev.continueintellijextension.auth.AuthListener
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.auth.ControlPlaneSessionInfo
import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.services.SettingsListener
import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.intellij.openapi.actionSystem.KeyboardShortcut
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ApplicationNamesInfo
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
import com.intellij.openapi.module.Module
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.project.ModuleListener
import com.intellij.openapi.roots.ModuleRootManager
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.vfs.newvfs.events.VFileDeleteEvent
import com.intellij.openapi.vfs.newvfs.events.VFileContentChangeEvent
import com.intellij.openapi.vfs.newvfs.events.VFileCreateEvent
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.Function

fun showTutorial(project: Project) {
    val tutorialFileName = getTutorialFileName()

    ContinuePluginStartupActivity::class.java.getClassLoader().getResourceAsStream(tutorialFileName)
        .use { `is` ->
            if (`is` == null) {
                throw IOException("Resource not found: $tutorialFileName")
            }
            var content = `is`.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }

            // All jetbrains will use J instead of L
            content = content.replace("[Cmd + L]", "[Cmd + J]")
            content = content.replace("[Cmd + Shift + L]", "[Cmd + Shift + J]")

            if (!System.getProperty("os.name").lowercase().contains("mac")) {
                content = content.replace("[Cmd + J]", "[Ctrl + J]")
                content = content.replace("[Cmd + Shift + J]", "[Ctrl + Shift + J]")
                content = content.replace("[Cmd + I]", "[Ctrl + I]")
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
        ApplicationManager.getApplication().invokeLater {
            removeShortcutFromAction(getPlatformSpecificKeyStroke("J"))
            removeShortcutFromAction(getPlatformSpecificKeyStroke("shift J"))
            removeShortcutFromAction(getPlatformSpecificKeyStroke("I"))
        }
        initializePlugin(project)
    }

    private fun getPlatformSpecificKeyStroke(key: String): String {
        val osName = System.getProperty("os.name").lowercase()
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
        val continuePluginService = project.service<ContinuePluginService>()

        coroutineScope.launch {
            val settings = service<ContinueExtensionSettings>()
            if (!settings.continueState.shownWelcomeDialog) {
                settings.continueState.shownWelcomeDialog = true
                // Open tutorial file
                showTutorial(project)
            }

            settings.addRemoteSyncJob()

            val ideProtocolClient = IdeProtocolClient(
                continuePluginService,
                coroutineScope,
                project
            )

            val diffManager = DiffManager(project)

            continuePluginService.diffManager = diffManager
            continuePluginService.ideProtocolClient = ideProtocolClient

            // Listen to changes to settings so the core can reload remote configuration
            val connection = ApplicationManager.getApplication().messageBus.connect()
            connection.subscribe(SettingsListener.TOPIC, object : SettingsListener {
                override fun settingsUpdated(settings: ContinueExtensionSettings.ContinueState) {
                    continuePluginService.coreMessenger?.request(
                        "config/ideSettingsUpdate", mapOf(
                            "remoteConfigServerUrl" to settings.remoteConfigServerUrl,
                            "remoteConfigSyncPeriod" to settings.remoteConfigSyncPeriod,
                            "userToken" to settings.userToken,
                        ), null
                    ) { _ -> }
                }
            })

            // Handle file changes and deletions - reindex
            connection.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    // Collect all relevant URIs for deletions
                    val deletedURIs = events.filterIsInstance<VFileDeleteEvent>()
                        .mapNotNull { event -> event.file.toUriOrNull() }

                    // Send "files/deleted" message if there are any deletions
                    if (deletedURIs.isNotEmpty()) {
                        val data = mapOf("uris" to deletedURIs)
                        continuePluginService.coreMessenger?.request("files/deleted", data, null) { _ -> }
                    }

                    // Collect all relevant URIs for content changes
                    val changedURIs = events.filterIsInstance<VFileContentChangeEvent>()
                        .mapNotNull { event -> event.file.toUriOrNull() }

                    // Notify core of content changes
                    if (changedURIs.isNotEmpty()) {
                        val data = mapOf("uris" to changedURIs)
                        continuePluginService.coreMessenger?.request("files/changed", data, null) { _ -> }
                    }

                    events.filterIsInstance<VFileCreateEvent>()
                        .mapNotNull { event -> event.file?.toUriOrNull() }
                        .takeIf { it.isNotEmpty() }?.let {
                            val data = mapOf("uris" to it)
                            continuePluginService.coreMessenger?.request("files/created", data, null) { _ -> }
                        }

                    // TODO: Missing handling of copying files, renaming files, etc.
                }
            })

            // Handle workspace directories changes
            connection.subscribe(
                ModuleListener.TOPIC,
                object : ModuleListener {
                    override fun modulesAdded(project: Project, modules: MutableList<out Module>) {

                        val allModulePaths = ModuleManager.getInstance(project).modules
                            .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }

                        val topLevelModulePaths = allModulePaths
                            .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }

                        continuePluginService.workspacePaths = topLevelModulePaths.toTypedArray();
                    }

                    override fun moduleRemoved(project: Project, module: Module) {
                        val removedPaths = ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } ;
                        continuePluginService.workspacePaths = continuePluginService.workspacePaths?.toList()?.filter { path -> removedPaths.none {removedPath -> path == removedPath }}?.toTypedArray();
                    }

                    override fun modulesRenamed(
                        project: Project,
                        modules: MutableList<out Module>,
                        oldNameProvider: Function<in Module, String>
                    ) {
                        val allModulePaths = ModuleManager.getInstance(project).modules
                            .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }

                        val topLevelModulePaths = allModulePaths
                            .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }

                        continuePluginService.workspacePaths = topLevelModulePaths.toTypedArray()
                    }
                }
            )

            connection.subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
                override fun fileClosed(source: FileEditorManager, file: VirtualFile) {
                    file.toUriOrNull()?.let { uri ->
                        val data = mapOf("uris" to listOf(uri))
                        continuePluginService.coreMessenger?.request("files/closed", data, null) { _ -> }
                    }
                }

                override fun fileOpened(source: FileEditorManager, file: VirtualFile) {
                    file.toUriOrNull()?.let { uri ->
                        val data = mapOf("uris" to listOf(uri))
                        continuePluginService.coreMessenger?.request("files/opened", data, null) { _ -> }
                    }
                }
            })


            // Listen for theme changes
            connection.subscribe(LafManagerListener.TOPIC, LafManagerListener {
                val colors = GetTheme().getTheme()
                project.getBrowser()?.sendToWebview("jetbrains/setColors", colors)
            })

            // Listen for clicking settings button to start the auth flow
            val authService = service<ContinueAuthService>()
            val initialSessionInfo = authService.loadControlPlaneSessionInfo()

            if (initialSessionInfo != null) {
                val data = mapOf(
                    "sessionInfo" to initialSessionInfo
                )
                continuePluginService.coreMessenger?.request("didChangeControlPlaneSessionInfo", data, null) { _ -> }
            }

            connection.subscribe(AuthListener.TOPIC, object : AuthListener {
                override fun startAuthFlow() {
                    authService.startAuthFlow(project, false)
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
                }
            })

            val listener =
                ContinuePluginSelectionListener(
                    coroutineScope,
                )

            // Reload the WebView
            continuePluginService?.let { pluginService ->
                val allModulePaths = ModuleManager.getInstance(project).modules
                    .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }

                val topLevelModulePaths = allModulePaths
                    .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }

                pluginService.workspacePaths = topLevelModulePaths.toTypedArray()
            }

            EditorFactory.getInstance().eventMulticaster.addSelectionListener(
                listener,
                project.service<ContinuePluginDisposable>()
            )

            val coreMessengerManager = CoreMessengerManager(project, ideProtocolClient, coroutineScope)
            continuePluginService.coreMessengerManager = coreMessengerManager
        }
    }
}