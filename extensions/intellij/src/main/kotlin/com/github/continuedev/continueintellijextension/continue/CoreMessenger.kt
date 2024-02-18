package com.github.continuedev.continueintellijextension.`continue`
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

import java.io.*

import com.google.gson.Gson

class CoreMessenger(continueCorePath: String, ideProtocolClient: IdeProtocolClient) {
    private val writer: OutputStreamWriter
    private val reader: BufferedReader
    private val process: Process
    private val gson = Gson()
    private val responseListeners = mutableMapOf<String, (String) -> Unit>()
    private val ideProtocolClient = ideProtocolClient

    private fun write(message: String) {
        writer.write(message + "\r\n")
        writer.flush()
    }

    private fun close() {
        writer.close()
        reader.close()
        val exitCode = process.waitFor()
        println("Subprocess exited with code: $exitCode")
    }

    fun request(messageType: String, data: Any?, messageId: String?, onResponse: (String) -> Unit) {
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
        val data = gson.toJson(responseMap["data"])

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

        // Responses for messageId
        responseListeners[messageId]?.let { listener ->
            listener(data)
            if (generatorTypes.contains(messageType)) {
                val parsedData = gson.fromJson(data, Map::class.java)
                val done = parsedData["done"] as Boolean?
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
            "command/run"
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
        "getPinnedFiles",
        "getSearchResults",
        "getProblems",
        "subprocess",
        "getBranch"
    )

    init {
        // Start the subprocess
        val processBuilder = ProcessBuilder(continueCorePath)
        process = processBuilder.start()

        val outputStream = process.outputStream
        val inputStream = process.inputStream

        writer = OutputStreamWriter(outputStream)
        reader = BufferedReader(InputStreamReader(inputStream))

        Thread {
            try {
                while (true) {
                    val line = reader.readLine()
                    if (line != null && line.isNotEmpty()) {
                        handleMessage(line)
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
                    outputStream.close()
                    inputStream.close()
                    process.destroy()
                } catch (e: IOException) {
                    e.printStackTrace()
                }
            }
        }.start()
    }
}
