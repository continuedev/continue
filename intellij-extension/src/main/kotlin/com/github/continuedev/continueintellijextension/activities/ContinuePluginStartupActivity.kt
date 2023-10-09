package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.constants.CONTINUE_PYTHON_SERVER_URL
import com.github.continuedev.continueintellijextension.constants.CONTINUE_SERVER_WEBSOCKET_PORT
import com.github.continuedev.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.continuedev.continueintellijextension.`continue`.IdeProtocolClient
import com.github.continuedev.continueintellijextension.`continue`.getMachineUniqueID
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.dispatchEventToWebview
import com.github.continuedev.continueintellijextension.utils.runJsInWebview
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.wm.ToolWindowManager
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.awt.BorderLayout
import java.awt.Dimension
import java.awt.FlowLayout
import java.awt.GridLayout
import java.io.*
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission
import javax.swing.*
import kotlin.math.max
import kotlin.math.min


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
    val exeFile = if (System.getProperty("os.name")
            .startsWith("Win", ignoreCase = true)
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
        os.contains("nix") || os.contains("mac") || os.contains("nux") -> listOf(
            "kill",
            "-9",
            pid
        )
        else -> throw UnsupportedOperationException("Unsupported operating system: $os")
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

fun checkOrKillRunningServer(): Boolean {
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



suspend fun startBinaryWithRetry(path: String) {
    var attempts = 0
    while (attempts < 5) {
        try {
            // Your suspend function call here
            ProcessBuilder(path).start()
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

suspend fun startContinuePythonServer() {
    println("server starting")
    val settings =
            ServiceManager.getService(ContinueExtensionSettings::class.java)
    val serverUrl = getContinueServerUrl()

    if ((serverUrl != CONTINUE_PYTHON_SERVER_URL && serverUrl != "http://127.0.0.1:65432") || settings.continueState.manuallyRunningServer) {
        println("Continue server being run manually, skipping start")
        return
    }

    if (checkOrKillRunningServer()) {
        println("Continue server already running")
        return
    }


    // Determine from OS details which file to download
    val filename = when {
        System.getProperty("os.name")
            .startsWith("Windows", ignoreCase = true) -> "windows/run.exe"
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
        println("Downloading Continue server binary...")
        // Download the binary from S3
        downloadFromS3(
                "continue-server-binaries",
                filename,
                destination,
                "us-west-1",
                false
        )

        // Set permissions on the binary
        setPermissions(destination)
    }

    // Validate that the binary exists
    if (!File(destination).exists()) {
        throw Error("Failed to download Continue server binary")
    }

    // Spawn server process
    println("Starting Continue server binary")
    startBinaryWithRetry(destination)

    // Write the server version to server_version.txt
    File(serverVersionPath()).writeText(getExtensionVersion())

    // Wait for the server process to start
    println("Waiting for Continue server to start...")
    while (getProcessId(CONTINUE_SERVER_WEBSOCKET_PORT) == null) {
        delay(1000)
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
                toolWindowManager.getToolWindow("ContinuePluginViewer")
        toolWindow?.show()
    }

    override fun createCenterPanel(): JComponent? {
        panel = JPanel(GridLayout(0, 1))
        panel!!.preferredSize = Dimension(500, panel!!.preferredSize.height)
        paragraph = JTextArea("""
            Welcome! You can access Continue from the right side panel by clicking on the logo.
            
            To ask a question about a piece of code, highlight it, use cmd/ctrl+J to select the code and focus the input box, then ask your question.
            To generate an inline edit, highlight the code you want to edit, use cmd/ctrl+shift+J, then type your requested edit.""".trimIndent())
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

class ContinuePluginStartupActivity : StartupActivity, Disposable {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    override fun runActivity(project: Project) {
        // Register Actions
        val actionManager = ActionManager.getInstance()
        actionManager.unregisterAction("InsertLiveTemplate")
        actionManager.unregisterAction("SurroundWithLiveTemplate")

        // Initialize Plugin
       ApplicationManager.getApplication().executeOnPooledThread {
//       GlobalScope.async(Dispatchers.IO) {
           initializePlugin(project)
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
                withContext(Dispatchers.Main) {
                    val dialog = WelcomeDialogWrapper(project)
                    dialog.show()
                }
                settings.continueState.shownWelcomeDialog = true
            }

            GlobalScope.async(Dispatchers.IO) {
                startContinuePythonServer()

                val wsUrl = getContinueServerUrl().replace("http://", "ws://").replace("https://", "wss://")
                val ideProtocolClient = IdeProtocolClient(
                    "$wsUrl/ide/ws",
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

                val newSessionId = ideProtocolClient.getSessionIdAsync().await()
                val sessionId = newSessionId ?: ""

                // Reload the WebView
                continuePluginService?.let {
                    val workspacePaths =
                            if (project.basePath != null) arrayOf(project.basePath) else emptyList<String>()
                    val dataMap = mutableMapOf(
                            "type" to "onLoad",
                            "sessionId" to sessionId,
                            "apiUrl" to getContinueServerUrl(),
                            "workspacePaths" to workspacePaths,
                            "vscMachineId" to getMachineUniqueID(),
                            "vscMediaUrl" to "http://continue",
                            "dataSwitchOn" to true
                    )
                    GlobalScope.async(Dispatchers.IO) {
                        dispatchEventToWebview(
                                "onLoad",
                                dataMap,
                                continuePluginService.continuePluginWindow.webView
                        )
                        val globalScheme = EditorColorsManager.getInstance().globalScheme
                        val defaultBackground = globalScheme.defaultBackground
                        val defaultForeground = globalScheme.defaultForeground
                        val defaultBackgroundHex = String.format("#%02x%02x%02x", defaultBackground.red, defaultBackground.green, defaultBackground.blue)
                        val defaultForegroundHex = String.format("#%02x%02x%02x", defaultForeground.red, defaultForeground.green, defaultForeground.blue)

                        val grayscale = (defaultBackground.red * 0.3 + defaultBackground.green * 0.59 + defaultBackground.blue * 0.11).toInt()

                        val adjustedRed: Int
                        val adjustedGreen: Int
                        val adjustedBlue: Int

                        val tint: Int = 20
                        if (grayscale > 128) { // if closer to white
                            adjustedRed = max(0, defaultBackground.red - tint)
                            adjustedGreen = max(0, defaultBackground.green - tint)
                            adjustedBlue = max(0, defaultBackground.blue - tint)
                        } else { // if closer to black
                            adjustedRed = min(255, defaultBackground.red + tint)
                            adjustedGreen = min(255, defaultBackground.green + tint)
                            adjustedBlue = min(255, defaultBackground.blue + tint)
                        }

                        val secondaryDarkHex = String.format("#%02x%02x%02x", adjustedRed, adjustedGreen, adjustedBlue)


                        runJsInWebview(
                                "document.body.style.setProperty(\"--vscode-editor-foreground\", \"$defaultForegroundHex\");",
                                continuePluginService.continuePluginWindow.webView
                        )
                        runJsInWebview(
                                "document.body.style.setProperty(\"--vscode-editor-background\", \"$defaultBackgroundHex\");",
                                continuePluginService.continuePluginWindow.webView
                        )
                        runJsInWebview(
                                "document.body.style.setProperty(\"--vscode-list-hoverBackground\", \"$secondaryDarkHex\");",
                                continuePluginService.continuePluginWindow.webView
                        )
                    }
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