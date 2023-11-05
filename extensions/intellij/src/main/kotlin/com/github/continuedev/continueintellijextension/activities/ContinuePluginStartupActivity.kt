package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.constants.CONTINUE_PYTHON_SERVER_URL
import com.github.continuedev.continueintellijextension.constants.CONTINUE_SERVER_WEBSOCKET_PORT
import com.github.continuedev.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.`continue`.getMachineUniqueID
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.CustomShortcutSet
import com.intellij.openapi.actionSystem.KeyboardShortcut
import com.intellij.openapi.actionSystem.Shortcut
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.keymap.KeymapManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.util.io.StreamUtil
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.awt.Dimension
import java.awt.Font
import java.awt.GridLayout
import java.io.*
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission
import javax.swing.*


fun getContinueGlobalPath(): String {
    val continuePath = Paths.get(System.getProperty("user.home"), ".continue")
    if (Files.notExists(continuePath)) {
        Files.createDirectories(continuePath)
    }
    return continuePath.toString()
}

fun serverPath(): String {
    val sPath = Paths.get(getContinueGlobalPath(), "server").toString()
    val directory = File(sPath)
    if (!directory.exists()) {
        directory.mkdir()
    }
    return sPath
}

fun serverVersionPath(): String {
    return Paths.get(serverPath(), "server_version.txt").toString()
}

fun serverBinaryPath(): String {
    val exeFile = if (System.getProperty("os.name").toLowerCase()
            .contains("win")
    ) "run.exe" else "run"
    return Paths.get(serverPath(), "exe", exeFile).toString()
}

fun downloadFromS3(
    bucket: String,
    filename: String,
    destination: String,
    region: String,
    useBackupUrl: Boolean = false

) {
    val client = OkHttpClient()
    val url = if (useBackupUrl)
        "https://s3.continue.dev/$filename"
    else
        "https://$bucket.s3.$region.amazonaws.com/$filename"

    val request = Request.Builder()
        .url(url)
        .build()

    // Create the necessary folders
    val directory = File(destination).parentFile
    if (!directory.exists()) {
        directory.mkdirs()
    }

    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) {
            Files.deleteIfExists(Paths.get(destination))
            throw IOException("No body returned when downloading from S3 bucket")
        }

        val fos = FileOutputStream(File(destination))
        val body = response.body!!.byteStream()

        fos.use {
            body.copyTo(it)
        }
    }
}

// Set permissions on the binary
fun setPermissions(destination: String) {
    val osName = System.getProperty("os.name").toLowerCase()
    if (osName.contains("mac") || osName.contains("darwin")) {
        ProcessBuilder(
            "xattr",
            "-dr",
            "com.apple.quarantine",
            destination
        ).start()
        setFilePermissions(destination, "rwxr-xr-x")
    } else if (osName.contains("nix") || osName.contains("nux") || osName.contains(
            "mac"
        )
    ) {
        setFilePermissions(destination, "rwxr-xr-x")
    }
}

fun setFilePermissions(path: String, posixPermissions: String) {
    val perms = HashSet<PosixFilePermission>()
    if (posixPermissions.contains("r")) perms.add(PosixFilePermission.OWNER_READ)
    if (posixPermissions.contains("w")) perms.add(PosixFilePermission.OWNER_WRITE)
    if (posixPermissions.contains("x")) perms.add(PosixFilePermission.OWNER_EXECUTE)
    Files.setPosixFilePermissions(Paths.get(path), perms)
}

fun getProcessId(port: Int): String? {
    val os = System.getProperty("os.name").toLowerCase()

    val command = when {
        os.contains("win") -> listOf(
            "cmd.exe",
            "/c",
            "netstat -ano | findstr :$port"
        )
        os.contains("nix") || os.contains("mac") || os.contains("nux") -> listOf(
            "/bin/sh",
            "-c",
            "lsof -t -i tcp:$port"
        )
        else -> throw UnsupportedOperationException("Unsupported operating system: $os")
    }

    val process = ProcessBuilder(command).start()
    val reader = BufferedReader(InputStreamReader(process.inputStream))

    return reader.readLine()?.trim()
}


fun killProcess(pid: String) {
    val os = System.getProperty("os.name").toLowerCase()
    val command = when {
        os.contains("win") -> listOf("taskkill", "/F", "/PID", pid)
        else -> listOf(
            "kill",
            "-9",
            pid
        )
    }

    try {
        val process = ProcessBuilder(command).start()
        process.waitFor()
    } catch (e: IOException) {
        e.printStackTrace()
    }
}

fun checkServerRunning(): Boolean {
    val processId = getProcessId(CONTINUE_SERVER_WEBSOCKET_PORT)
    return processId != null
}

fun getExtensionVersion(): String {
    val pluginId =
        PluginId.getId("com.github.continuedev.continueintellijextension")
    val pluginDescriptor = PluginManagerCore.getPlugin(pluginId)
    return pluginDescriptor?.version ?: ""
}

fun checkOrKillRunningServer(project: Project): Boolean {
    val continuePluginService = ServiceManager.getService(
            project,
            ContinuePluginService::class.java
    )
    val serverRunning: Boolean = checkServerRunning()
    var shouldKillAndReplace = true

    val serverVersionPath = serverVersionPath()
    if (File(serverVersionPath).exists()) {
        val serverVersion = File(serverVersionPath).readText()
        if (serverVersion == getExtensionVersion() && serverRunning) {
            println("Continue server of correct version already running")
            shouldKillAndReplace = false
        }
    }

    if (shouldKillAndReplace) {
        continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                "type" to "serverStatus",
                "message" to "Stopping Outdated Server"
        ))
        println("Killing server from old version of Continue")
        val pid = getProcessId(CONTINUE_SERVER_WEBSOCKET_PORT)
        pid?.let { killProcess(it) }

        if (File(serverVersionPath).exists()) {
            File(serverVersionPath).delete()
        }

        val serverBinary = serverBinaryPath()
        if (File(serverBinary).exists()) {
            File(serverBinary).delete()
        }

    }
    return serverRunning && !shouldKillAndReplace
}

fun runBinary(path: String) {
    try {
        if (System.getProperty("os.name").toLowerCase().contains("win")) {
            // Windows approach
            val script = """
                Set WshShell = CreateObject("WScript.Shell")
                WshShell.Run "$path", 0
                Set WshShell = Nothing
            """.trimIndent()
            val scriptPath = Paths.get("startProcess.vbs")
            Files.writeString(scriptPath, script)
            val processBuilder = ProcessBuilder("cmd", "/c", "start", "cscript", scriptPath.toString())
            processBuilder.start()
        } else {
            // Unix-like approach
            val processBuilder = ProcessBuilder("sh", "-c", "nohup $path > /dev/null 2>&1 &")
            processBuilder.start()
        }
    } catch (e: IOException) {
        e.printStackTrace()
    }
}


suspend fun startBinaryWithRetry(path: String) {
    var attempts = 0
    while (attempts < 5) {
        try {
            // Your suspend function call here
            runBinary(path)
            break // If the function call is successful, break the loop
        } catch (e: Exception) {
            attempts++
            delay(500)
            if (attempts == 5) throw e // If this was the last attempt, rethrow the exception
        }
    }
}

fun getContinueServerUrl(): String {
    val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
    return settings.continueState.serverUrl
}

suspend fun startContinuePythonServer(project: Project) {
    println("server starting")
    val continuePluginService = ServiceManager.getService(
            project,
            ContinuePluginService::class.java
    )

    val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
    val serverUrl = getContinueServerUrl()

    if ((serverUrl != CONTINUE_PYTHON_SERVER_URL && serverUrl != "http://127.0.0.1:65432") || settings.continueState.manuallyRunningServer) {
        continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                "type" to "serverStatus",
                "message" to "Connecting to Continue Server"
        ))

        println("Continue server being run manually, skipping start")
        return
    }

    if (checkOrKillRunningServer(project)) {
        continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                "type" to "serverStatus",
                "message" to "Connecting to Continue Server"
        ))
        println("Continue server already running")
        return
    }


    // Determine from OS details which file to download
    val filename = when {
        System.getProperty("os.name")
            .toLowerCase().contains("win") -> "windows/run.exe"
        System.getProperty("os.name").startsWith("Mac", ignoreCase = true) ->
            if (System.getProperty("os.arch") == "arm64") "apple-silicon/run" else "mac/run"
        else -> "linux/run"
    }

    val destination = serverBinaryPath()

    // Check whether the binary needs to be downloaded
    var shouldDownload = true
    if (File(destination).exists()) {
        if (File(serverVersionPath()).exists()) {
            val serverVersion = File(serverVersionPath()).readText()
            if (serverVersion == getExtensionVersion()) {
                println("Continue server already downloaded")
                shouldDownload = false
            } else {
                println("Old version of the server downloaded, removing")
                File(destination).delete()
            }
        } else {
            println("Old version of the server downloaded, removing")
            File(destination).delete()
        }
    }

    if (shouldDownload) {
        continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                "type" to "serverStatus",
                "message" to "Downloading Continue server binary"
        ))

        println("Downloading Continue Server Binary")
        // Download the binary from S3
        try {
            downloadFromS3(
                    "continue-server-binaries",
                    filename,
                    destination,
                    "us-west-1",
                    false
            )
        } catch (e: Exception) {
            continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                    "type" to "serverStatus",
                    "message" to "First download failed, attempting backup"
            ))
            try {
                downloadFromS3(
                        "continue-server-binaries",
                        filename,
                        destination,
                        "us-west-1",
                        true
                )
            } catch (e: Exception) {
                continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                        "type" to "serverStatus",
                        "message" to "Failed to download Continue server binary: ${e.message}"
                ))
                throw e
            }
        }


        // Set permissions on the binary
        setPermissions(destination)
    }

    // Validate that the binary exists
    if (!File(destination).exists()) {
        continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                "type" to "serverStatus",
                "message" to "Failed to download Continue server binary"
        ))

        throw Error("Failed to download Continue server binary")
    }

    // Spawn server process
    continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
            "type" to "serverStatus",
            "message" to "Launching Continue Server"
    ))
    println("Starting Continue server binary")
    startBinaryWithRetry(destination)

    // Write the server version to server_version.txt
    File(serverVersionPath()).writeText(getExtensionVersion())

    // Wait for the server process to start
    println("Waiting for Continue server to start...")
    var i = 1
    while (getProcessId(CONTINUE_SERVER_WEBSOCKET_PORT) == null) {
        delay(1000)
        continuePluginService.dispatchCustomEvent("serverStatus", mutableMapOf(
                "type" to "serverStatus",
                "message" to "Launching Continue Server" + ".".repeat(i % 4)
        ))
        i++
    }
    println("Continue server started")
}

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


        val actionManager = ActionManager.getInstance()
//         for (actionId in actionIds) {
//             if (actionId.startsWith("continue")) {
//                 continue
//             }
//             val action = actionManager.getAction(actionId)
//             val shortcuts = action.shortcutSet.shortcuts.filterNot { it is KeyboardShortcut && it.firstKeyStroke == keyStroke }.toTypedArray()
//             val newShortcutSet = CustomShortcutSet(*shortcuts)
//             action.registerCustomShortcutSet(newShortcutSet, null)
//         }
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
                withContext(Dispatchers.Main) {
                    val dialog = WelcomeDialogWrapper(project)
                    dialog.show()
                }
                settings.continueState.shownWelcomeDialog = true
            }

            GlobalScope.async(Dispatchers.IO) {
                startContinuePythonServer(project)

                val ideProtocolClient = IdeProtocolClient(
                    continuePluginService,
                    defaultStrategy,
                    coroutineScope,
                    project.basePath ?: "/",
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

                    continuePluginService.worksapcePaths = workspacePaths as Array<String>
                }

                EditorFactory.getInstance().eventMulticaster.addSelectionListener(
                        listener,
                        this@ContinuePluginStartupActivity
                )

            }


        }
    }

    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}