package com.github.continuedev.continueintellijextension.activities

import com.github.continuedev.continueintellijextension.`continue`.DefaultTextSelectionStrategy
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.listeners.ContinuePluginSelectionListener
import com.github.continuedev.continueintellijextension.actions.ToggleAuxiliaryBarAction
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.execution.target.value.constant
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow

import java.net.NetworkInterface
import java.util.*

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.PosixFilePermission
import java.util.HashSet

object SessionStore {
    val sessionId: MutableStateFlow<String?> = MutableStateFlow(null)
}

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
fun serverBinaryPath(): String {
    val exeFile = if (System.getProperty("os.name").startsWith("Win", ignoreCase = true)) "run.exe" else "run"
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
        "https://$bucket.s3.$region.amazonaws.com/$filename";

    val request = Request.Builder()
            .url(url)
            .build()

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
        ProcessBuilder("xattr", "-dr", "com.apple.quarantine", destination).start()
        setFilePermissions(destination, "rwxr-xr-x")
    } else if (osName.contains("nix") || osName.contains("nux") || osName.contains("mac")) {
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

fun startContinuePythonServer() {
    // Determine from OS details which file to download
    val filename = when {
        System.getProperty("os.name").startsWith("Windows", ignoreCase = true) -> "windows/run.exe"
        System.getProperty("os.name").startsWith("Mac", ignoreCase = true) ->
            if (System.getProperty("os.arch") == "arm64") "apple-silicon/run" else "mac/run"
        else -> "linux/run"
    }

    val destination = serverBinaryPath();

    // Download the binary from S3
    downloadFromS3(
            "continue-server-binaries",
            filename,
            destination,
            "us-west-1",
            false
    );

    // Set permissions on the binary
    setPermissions(destination)

    // Spawn server process
    ProcessBuilder(destination).start();
}


class ContinuePluginStartupActivity : StartupActivity, Disposable {
    val coroutineScope = CoroutineScope(Dispatchers.IO)

    override fun runActivity(project: Project) {
        // Register Actions
        val actionManager = ActionManager.getInstance()
        actionManager.registerAction("FocusContinueInput", ToggleAuxiliaryBarAction())

        // Download and start the Continue Python Server
        startContinuePythonServer()

        coroutineScope.launch {
            // Delay to allow the server to start
            delay(3000)

            val client = IdeProtocolClient("ws://localhost:65432/ide/ws", coroutineScope, project.basePath ?: "/")
            val defaultStrategy = DefaultTextSelectionStrategy(client, coroutineScope)
            val listener = ContinuePluginSelectionListener(defaultStrategy)


            val newSessionId = client.getSessionIdAsync().await()
            val sessionId = newSessionId ?: ""

            // After sessionID fetched
            withContext(Dispatchers.Main) {
                val toolWindowManager = ToolWindowManager.getInstance(project)
                val toolWindow = toolWindowManager.getToolWindow("ContinuePluginViewer")
                toolWindow?.show()

                // Assuming ContinuePluginService is your service where the ToolWindow is registered
                val continuePluginService = ServiceManager.getService(project, ContinuePluginService::class.java)

                // Reload the WebView
                continuePluginService?.let {
                    val workspacePaths = if (project.basePath != null) arrayOf(project.basePath) else emptyList<String>()
                    val dataMap = mutableMapOf(
                            "type" to "onUILoad",
                            "sessionId" to sessionId,
                            "apiUrl" to "http://localhost:65432",
                            "workspacePaths" to workspacePaths,  // or your actual workspace paths
                            "vscMachineId" to getMachineUniqueID(),
                            "vscMediaUrl" to "http://continue",
                            "dataSwitchOn" to true  // or your actual condition
                    )
                    it.dispatchCustomEvent("onLoad", dataMap)
                }
            }
            EditorFactory.getInstance().eventMulticaster.addSelectionListener(listener, this@ContinuePluginStartupActivity)
        }
    }

    override fun dispose() {
        // Cleanup resources here
        coroutineScope.cancel()
    }
}