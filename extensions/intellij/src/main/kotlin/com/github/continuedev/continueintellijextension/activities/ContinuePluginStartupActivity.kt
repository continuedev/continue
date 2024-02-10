package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.`continue`.startProxyServer
import com.github.continuedev.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
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

        val defaultStrategy = DefaultTextSelectionStrategy()

        coroutineScope.launch {
            val settings =
                    ServiceManager.getService(ContinueExtensionSettings::class.java)
            if (!settings.continueState.shownWelcomeDialog) {
                settings.continueState.shownWelcomeDialog = true
                // Open continue_tutorial.py
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

                    if (virtualFile != null) {
                        ApplicationManager.getApplication().invokeLater {
                            FileEditorManager.getInstance(project).openFile(virtualFile, true)
                        }
                    }
                }

                // Show the welcome dialog
//                withContext(Dispatchers.Main) {
//                    val dialog = WelcomeDialogWrapper(project)
//                    dialog.show()
//                }
//                settings.continueState.shownWelcomeDialog = true
            }

            GlobalScope.async(Dispatchers.IO) {
                val ideProtocolClient = IdeProtocolClient(
                    continuePluginService,
                    defaultStrategy,
                    coroutineScope,
                    project.basePath,
                    project
                )

                continuePluginService.ideProtocolClient = ideProtocolClient

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

        }
    }

    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}