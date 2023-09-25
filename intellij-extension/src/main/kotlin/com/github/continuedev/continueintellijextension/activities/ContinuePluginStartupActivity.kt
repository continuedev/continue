package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.actions.ToggleAuxiliaryBarAction
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.dispatchEventToWebview
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.components.ComponentManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.wm.ToolWindowManager
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission
import java.util.HashSet

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
        os.contains("win") -> listOf("cmd.exe", "/c", "netstat -ano | findstr :$port")
        os.contains("nix") || os.contains("mac") || os.contains("nux") -> listOf("/bin/sh", "-c", "lsof -t -i tcp:$port")
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
        os.contains("nix") || os.contains("mac") || os.contains("nux") -> listOf("kill", "-9", pid)
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
    val processId = getProcessId(65432)
    return processId != null
}
fun getExtensionVersion(): String {
    val pluginId = PluginId.getId("com.github.continuedev.continueintellijextension")
    val pluginDescriptor = PluginManagerCore.getPlugin(pluginId)
    return pluginDescriptor?.version ?: ""
}

suspend fun checkOrKillRunningServer(): Boolean = withContext(Dispatchers.IO) {
    val serverRunning = checkServerRunning()
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
        val pid = getProcessId(65432)
        pid?.let { killProcess(it) }

        if (File(serverVersionPath).exists()) {
            File(serverVersionPath).delete()
        }

        val serverBinary = serverBinaryPath()
        if (File(serverBinary).exists()) {
            File(serverBinary).delete()
        }
    }

    return@withContext serverRunning && !shouldKillAndReplace
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


suspend fun startContinuePythonServer() {
    val settings = ServiceManager.getService(ContinueExtensionSettings::class.java)
    val serverUrl = settings.continueState.serverUrl ?: "http://localhost:65432"

    if ((serverUrl != "http://localhost:65432" && serverUrl != "http://127.0.0.1:65432") || settings.continueState.manuallyRunningServer) {
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
    startBinaryWithRetry(destination)

    // Write the server version to server_version.txt
    File(serverVersionPath()).writeText(getExtensionVersion())
}


class ContinuePluginStartupActivity : StartupActivity, Disposable {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    override fun runActivity(project: Project) {
        // Register Actions
        val actionManager = ActionManager.getInstance()
        actionManager.registerAction(
            "FocusContinueInput",
            ToggleAuxiliaryBarAction()
        )

        // Initialize Plugin
        initializePlugin(project)
    }

    private fun initializePlugin(project: Project) {
        val continuePluginService = ServiceManager.getService(
            project,
            ContinuePluginService::class.java
        )

        val defaultStrategy = DefaultTextSelectionStrategy()

        coroutineScope.launch {
            startContinuePythonServer()

            while (getProcessId(65432) == null) {
                delay(1000)
            }

            val ideProtocolClient = IdeProtocolClient(
                "ws://localhost:65432/ide/ws",
                continuePluginService,
                defaultStrategy,
                coroutineScope,
                project.basePath ?: "/",
                project
            )

            val listener =
                ContinuePluginSelectionListener(ideProtocolClient, coroutineScope)

            val newSessionId = ideProtocolClient.getSessionIdAsync().await()
            val sessionId = newSessionId ?: ""

            // After sessionID fetched
            withContext(Dispatchers.Main) {
                val toolWindowManager = ToolWindowManager.getInstance(project)
                val toolWindow =
                    toolWindowManager.getToolWindow("ContinuePluginViewer")
                toolWindow?.show()

                // Reload the WebView
                continuePluginService?.let {
                    val workspacePaths =
                        if (project.basePath != null) arrayOf(project.basePath) else emptyList<String>()
                    val dataMap = mutableMapOf(
                        "type" to "onUILoad",
                        "sessionId" to sessionId,
                        "apiUrl" to "http://localhost:65432",
                        "workspacePaths" to workspacePaths,  // or your actual workspace paths
                        "vscMachineId" to "yourMachineId",
                        "vscMediaUrl" to "yourMediaUrl",
                        "dataSwitchOn" to true  // or your actual condition
                    )
                    dispatchEventToWebview(
                        "onUILoad",
                        dataMap,
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

    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}