package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
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
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.util.io.StreamUtil
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.wm.ToolWindowManager
import kotlinx.coroutines.*
import java.awt.Dimension
import java.awt.Font
import java.awt.GridLayout
import java.io.*
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Paths
import javax.swing.*
import com.intellij.openapi.application.PathManager;
import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.extensions.PluginId

class WelcomeDialogWrapper(val project: Project) : DialogWrapper(true) {
    private var panel: JPanel? = null
    private var paragraph: JTextArea? = null

    init {
        init()
        title = "Welcome to Continue"
    }

    override fun doOKAction() {
        super.doOKAction()
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow =
                toolWindowManager.getToolWindow("Continue")
        toolWindow?.show()
    }

    override fun createCenterPanel(): JComponent? {
        panel = JPanel(GridLayout(0, 1))
        panel!!.preferredSize = Dimension(500, panel!!.preferredSize.height)
        val paragraph = JLabel()
        val shortcutKey = if (System.getProperty("os.name").toLowerCase().contains("mac")) "⌘" else "⌃"
        paragraph.text = """
            <html>Welcome! You can access Continue from the right side panel by clicking on the logo.<br><br>
            
            To <b>ask a question</b> about a piece of code: highlight it, use <b>$shortcutKey J</b> to select the code and focus the input box, then ask your question.<br><br>
            To generate an <b>inline edit</b>: highlight the code you want to edit, use <b>$shortcutKey ⇧ J</b>, then type your requested edit.</html>""".trimIndent()

        paragraph.font = Font("Arial", Font.PLAIN, 16)

        panel!!.add(paragraph)

        return panel
    }

    override fun createActions(): Array<Action> {
        val okAction = getOKAction()
        okAction.putValue(Action.NAME, "Open Continue")

        val cancelAction = getCancelAction()
        cancelAction.putValue(Action.NAME, "Cancel")

        return arrayOf(okAction, cancelAction)
    }
}

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

        val theme = GetTheme().getTheme()

        val defaultStrategy = DefaultTextSelectionStrategy()

        coroutineScope.launch {
            val settings =
                    ServiceManager.getService(ContinueExtensionSettings::class.java)
            if (!settings.continueState.shownWelcomeDialog) {
                settings.continueState.shownWelcomeDialog = true
                // Open continue_tutorial.py
                showTutorial(project)

                // Show the welcome dialog
//                withContext(Dispatchers.Main) {
//                    val dialog = WelcomeDialogWrapper(project)
//                    dialog.show()
//                }
//                settings.continueState.shownWelcomeDialog = true
            }

            val ideProtocolClient = IdeProtocolClient(
                    continuePluginService,
                    defaultStrategy,
                    coroutineScope,
                    project.basePath,
                    project
            )

            continuePluginService.ideProtocolClient = ideProtocolClient

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

                try {
                    startProxyServer()
                } catch (e: Exception) {
                    println(e)
                }
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

                val corePath = Paths.get(pluginPath.toString(), "core").toString()
                val targetPath = Paths.get(corePath, target).toString()
                val continueCorePath = Paths.get(targetPath, "pkg" + (if (os == "win32") ".exe" else "")).toString()

                // Copy targetPath / node_sqlite3.node to core / node_sqlite3.node
                val nodeSqlite3Path = Paths.get(targetPath, "node_sqlite3.node")

                // Create the build/Release path first
                File(Paths.get(corePath, "build", "Release").toString()).mkdirs()

                val coreNodeSqlite3Path = Paths.get(corePath, "build", "Release", "node_sqlite3.node")
                if (!File(coreNodeSqlite3Path.toString()).exists()) {
                    Files.copy(nodeSqlite3Path, coreNodeSqlite3Path)
                }

                val coreMessenger = CoreMessenger(continueCorePath, ideProtocolClient);
                continuePluginService.coreMessenger = coreMessenger
            }
        }
    }

    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}