package com.github.continuedev.continueintellijextension.`continue`
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

import java.io.*

import com.google.gson.Gson
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission

class CoreMessenger(private val project: Project, esbuildPath: String, continueCorePath: String, ideProtocolClient: IdeProtocolClient) {
    private var writer: Writer? = null
    private var reader: BufferedReader? = null
    private var process: Process? = null
    private val gson = Gson()
    private val responseListeners = mutableMapOf<String, (Any?) -> Unit>()
    private val ideProtocolClient = ideProtocolClient
    private val useTcp: Boolean = false

    private fun write(message: String) {
        try {
            writer?.write(message + "\r\n")
            writer?.flush()
        } catch (e: Exception) {
            println("Error writing to Continue core: $e")
        }
    }

    private fun close() {
        writer?.close()
        reader?.close()
        val exitCode = process?.waitFor()
        println("Subprocess exited with code: $exitCode")
    }

    fun request(messageType: String, data: Any?, messageId: String?, onResponse: (Any?) -> Unit) {
        val id = messageId ?: uuid()
        val message = gson.toJson(mapOf(
                "messageId" to id,
                "messageType" to messageType,
                "data" to data
        ))
        responseListeners[id] = onResponse
        write(message)
    }

    private fun handleMessage(json: String) {
        val responseMap = gson.fromJson(json, Map::class.java)
        val messageId = responseMap["messageId"].toString()
        val messageType = responseMap["messageType"].toString()
        val data = responseMap["data"]

        // IDE listeners
        if (ideMessageTypes.contains(messageType)) {
            ideProtocolClient.handleMessage(json) { data ->
                val message = gson.toJson(mapOf(
                        "messageId" to messageId,
                        "messageType" to messageType,
                        "data" to data
                ))
                write(message)
            };
        }

        // Forward to webview
        if (PASS_THROUGH_TO_WEBVIEW.contains(messageType)) {
            // TODO: Currently we aren't set up to receive a response back from the webview
            // Can circumvent for getDefaultsModelTitle here for now
            if (messageType == "getDefaultModelTitle") {
                val continueSettingsService = service<ContinueExtensionSettings>()
                val defaultModelTitle = continueSettingsService.continueState.lastSelectedInlineEditModel;
                val message = gson.toJson(mapOf(
                        "messageId" to messageId,
                        "messageType" to messageType,
                        "data" to defaultModelTitle
                ))
                write(message)
            }
            val continuePluginService = project.service<ContinuePluginService>()
            continuePluginService.sendToWebview(messageType, responseMap["data"], messageType)
        }

        // Responses for messageId
        responseListeners[messageId]?.let { listener ->
            listener(data)
            if (generatorTypes.contains(messageType)) {
                val done = (data as Map<String, Boolean?>)["done"]
                if (done == true) {
                    responseListeners.remove(messageId)
                } else {}
            } else {
                responseListeners.remove(messageId)
            }

        }
    }

    private val generatorTypes = listOf(
            "llm/streamComplete",
            "llm/streamChat",
            "command/run",
            "streamDiffLines"
    )

    private val ideMessageTypes = listOf(
        "readRangeInFile",
        "isTelemetryEnabled",
        "getUniqueId",
        "getWorkspaceConfigs",
        "getDiff",
        "getTerminalContents",
        "listWorkspaceContents",
        "getWorkspaceDirs",
        "showLines",
        "listFolders",
        "getContinueDir",
        "writeFile",
        "showVirtualFile",
        "openFile",
        "runCommand",
        "saveFile",
        "readFile",
        "showDiff",
        "getOpenFiles",
        "getCurrentFile",
        "getPinnedFiles",
        "getSearchResults",
        "getProblems",
        "subprocess",
        "getBranch",
        "getIdeInfo",
        "getIdeSettings",
        "errorPopup",
        "getRepoName",
        "listDir",
        "getGitRootPath",
        "getLastModified",
        "insertAtCursor",
        "applyToFile",
        "getGitHubAuthToken",
        "setGitHubAuthToken",
    )

    private val PASS_THROUGH_TO_WEBVIEW = listOf<String>(
            "configUpdate",
            "getDefaultModelTitle",
            "indexProgress",
            "refreshSubmenuItems"
    )

    private fun setPermissions(destination: String) {
        val osName = System.getProperty("os.name").toLowerCase()
        if (osName.contains("mac") || osName.contains("darwin")) {
            ProcessBuilder(
                    "xattr",
                    "-dr",
                    "com.apple.quarantine",
                    destination
            ).start()
            setFilePermissions(destination, "rwxr-xr-x")
        } else if (osName.contains("nix") || osName.contains("nux") || osName.contains("mac")) {
            setFilePermissions(destination, "rwxr-xr-x")
        }
    }

    private fun setFilePermissions(path: String, posixPermissions: String) {
        val perms = HashSet<PosixFilePermission>()
        if (posixPermissions.contains("r")) perms.add(PosixFilePermission.OWNER_READ)
        if (posixPermissions.contains("w")) perms.add(PosixFilePermission.OWNER_WRITE)
        if (posixPermissions.contains("x")) perms.add(PosixFilePermission.OWNER_EXECUTE)
        Files.setPosixFilePermissions(Paths.get(path), perms)
    }

    init {
        if (useTcp) {
            try {
                val socket = Socket("127.0.0.1", 3000)
                val writer = PrintWriter(socket.getOutputStream(), true)
                this.writer = writer
                val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
                this.reader = reader

                Thread {
                    try {
                        while (true) {
                            val line = reader.readLine()
                            if (line != null && line.isNotEmpty()) {
                                try {
                                    handleMessage(line)
                                } catch (e: Exception) {
                                    println("Error handling message: $line")
                                    println(e)
                                }
                            } else {
                                Thread.sleep(100)
                            }
                        }
                    } catch (e: IOException) {
                        e.printStackTrace()
                    } finally {
                        try {
                            reader.close()
                            writer.close()
                        } catch (e: IOException) {
                            e.printStackTrace()
                        }
                    }
                }.start()
            } catch (e: Exception) {
                println("An error occurred: ${e.message}")
            }
        } else {
            // Set proper permissions
            setPermissions(continueCorePath)
            setPermissions(esbuildPath)

            // Start the subprocess
            val processBuilder = ProcessBuilder(continueCorePath)
                    .directory(File(continueCorePath).parentFile)
            process = processBuilder.start()

            val outputStream = process!!.outputStream
            val inputStream = process!!.inputStream

            writer = OutputStreamWriter(outputStream, StandardCharsets.UTF_8)
            reader = BufferedReader(InputStreamReader(inputStream, StandardCharsets.UTF_8))

            process!!.onExit().thenRun {
                val err = process?.errorStream?.bufferedReader()?.readText()?.trim()
                println("Core process exited with output: $err")
                ideProtocolClient.showMessage("Core process exited with output: $err")
            }

            Thread {
                try {
                    while (true) {
                        val line = reader?.readLine()
                        if (line != null && line.isNotEmpty()) {
                            try {
                                handleMessage(line)
                            } catch (e: Exception) {
                                println("Error handling message: $line")
                                println(e)
                            }
                        } else {
                            Thread.sleep(100)
                        }
                    }
                } catch (e: IOException) {
                    e.printStackTrace()
                } finally {
                    try {
                        reader?.close()
                        writer?.close()
                        outputStream.close()
                        inputStream.close()
                        process?.destroy()
                    } catch (e: IOException) {
                        e.printStackTrace()
                    }
                }
            }.start()
        }
    }
}
