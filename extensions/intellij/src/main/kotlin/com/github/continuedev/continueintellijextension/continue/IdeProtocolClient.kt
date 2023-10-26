package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.MessageType
import com.intellij.openapi.ui.popup.Balloon
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.util.Computable
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.wm.WindowManager
import com.intellij.testFramework.LightVirtualFile
import com.intellij.ui.awt.RelativePoint
import kotlinx.coroutines.*
import okhttp3.*
import java.io.File
import java.net.NetworkInterface
import java.util.UUID

fun uuid(): String {
    return UUID.randomUUID().toString()
}


data class WebSocketMessage<T>(val messageType: String, val messageId: String, val data: T)
data class WorkspaceDirectory(val workspaceDirectory: String)
data class UniqueId(val uniqueId: String)
data class ReadFile(val contents: String)
data class VisibleFiles(val visibleFiles: List<String>)
data class Position(val line: Int, val character: Int)
data class Range(val start: Position, val end: Position)
data class RangeInFile(val filepath: String, val range: Range)
data class GetTerminalContents(val contents: String)
data class ListDirectoryContents(val contents: List<String>)
data class RangeInFileWithContents(val filepath: String, val range: Range, val contents: String)
data class HighlightedCodeUpdate(val highlightedCode: List<RangeInFileWithContents>, val edit: Boolean)
data class HighlightedCode(val highlightedCode: List<RangeInFile>)
data class AcceptRejectDiff(val accepted: Boolean, val stepIndex: Int)
data class DeleteAtIndex(val index: Int)
data class MainUserInput(val input: String)
data class IdeInfo(val name: String, val version: String?, val remoteName: String?)

fun getMachineUniqueID(): String {
    val sb = StringBuilder()
    val networkInterfaces = NetworkInterface.getNetworkInterfaces()

    while (networkInterfaces.hasMoreElements()) {
        val networkInterface = networkInterfaces.nextElement()
        val mac = networkInterface.hardwareAddress

        if (mac != null) {
            for (i in mac.indices) {
                sb.append(
                    String.format(
                        "%02X%s",
                        mac[i],
                        if (i < mac.size - 1) "-" else ""
                    )
                )
            }
            return sb.toString()
        }
    }

    return "No MAC Address Found"
}

class IdeProtocolClient(
    private val serverUrl: String = "ws://localhost:65432/ide/ws",
    private val continuePluginService: ContinuePluginService,
    private val textSelectionStrategy: TextSelectionStrategy,
    private val coroutineScope: CoroutineScope,
    private val workspacePath: String,
    private val project: Project
) {
    private val eventListeners = mutableListOf<WebSocketEventListener>()
    private var webSocket: WebSocket? = null
    private val okHttpClient = OkHttpClient()

    val diffManager = DiffManager(project)

    init {
        initWebSocket()
    }

    var sessionId: String? = null

    fun getSessionIdAsync(): Deferred<String?> = coroutineScope.async {
        withTimeoutOrNull(10000) {
            while ((webSocket?.queueSize() ?: 0) > 0) {
                delay(1000)
            }
        }
        println("Getting session ID")
        val respDeferred = sendAndReceive("getSessionId", mapOf())
        val resp = respDeferred.await()  // Awaiting the deferred response
        println(resp)
        val data = (resp as? Map<*, *>)?.get("data") as? Map<*, *>
        sessionId = data?.get("sessionId").toString()
        println("New Continue session with ID: $sessionId")
        sessionId
    }

    private val pendingResponses: MutableMap<String, CompletableDeferred<Any>> =
        mutableMapOf()

    fun sendAndReceive(
        messageType: String,
        data: Map<String, Any>
    ): CompletableDeferred<Any> {
        val deferred = CompletableDeferred<Any>()
        pendingResponses[messageType] =
            deferred  // Store the deferred object for later resolution

        sendMessage(messageType, data)
        return deferred
    }

    private fun serializeMessage(data: Map<String, Any>): String {
        val gson = Gson()
        return gson.toJson(data)
    }

    private fun handleWebsocketMessage(webSocket: WebSocket, text: String) {
        coroutineScope.launch(Dispatchers.IO) {
            val parsedMessage: Map<String, Any> = Gson().fromJson(
                    text,
                    object : TypeToken<Map<String, Any>>() {}.type
            )
            val messageType = parsedMessage["messageType"] as? String
            val messageId = parsedMessage["messageId"] as? String
            if (messageId == null) {

                println("Received message without messageId: $text")
                return@launch
            }
            val data = parsedMessage["data"] as Map<*, *>

            try {
                when (messageType) {
                    "workspaceDirectory" -> {
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "workspaceDirectory",
                                                messageId,
                                                WorkspaceDirectory(workspaceDirectory())
                                        )
                                )
                        )
                    }

                    "uniqueId" -> webSocket.send(
                            Gson().toJson(
                                    WebSocketMessage(
                                            "uniqueId",
                                            messageId,
                                            UniqueId(uniqueId())
                                    )
                            )
                    )

                    "ide" -> {
                        val applicationInfo = ApplicationInfo.getInstance()
                        val ideName: String = applicationInfo.fullApplicationName
                        val ideVersion = applicationInfo.fullVersion
                        val sshClient = System.getenv("SSH_CLIENT")
                        val sshTty = System.getenv("SSH_TTY")

                        var remoteName: String? = null
                        if (sshClient != null || sshTty != null) {
                            remoteName = "ssh"
                        }
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "ide",
                                                messageId,
                                                IdeInfo(
                                                        ideName, ideVersion, remoteName
                                                )
                                        )
                                )
                        )
                    }

                    "showDiff" -> {
                        diffManager.showDiff(
                                data["filepath"] as String,
                                data["replacement"] as String,
                                (data["step_index"] as Double).toInt()
                        )
                    }

                    "readFile" -> {
                        val msg =
                                ReadFile(readFile(data["filepath"] as String))
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "readFile",
                                                messageId,
                                                msg
                                        )
                                )
                        )
                    }

                    "listDirectoryContents" -> {
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "listDirectoryContents",
                                                messageId,
                                                ListDirectoryContents(listDirectoryContents())
                                        )
                                )
                        )
                    }

                    "getTerminalContents" -> {
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "getTerminalContents",
                                                messageId,
                                                GetTerminalContents("Terminal cannot be accessed in JetBrains IDE")
                                        )
                                )
                        )
                    }

                    "visibleFiles" -> {
                        val msg = VisibleFiles(visibleFiles())
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "visibleFiles",
                                                messageId,
                                                msg
                                        )
                                )
                        )
                    }

                    "saveFile" -> saveFile(data["filepath"] as String)
                    "showVirtualFile" -> showVirtualFile(
                            data["name"] as String,
                            data["contents"] as String
                    )

                    "connected" -> {}
                    "showMessage" -> showMessage(data["message"] as String)
                    "setFileOpen" -> setFileOpen(
                            data["filepath"] as String,
                            data["open"] as Boolean
                    )

                    "highlightCode" -> {
                        val gson = Gson()
                        val json = gson.toJson(data["rangeInFile"])
                        val type = object : TypeToken<RangeInFile>() {}.type
                        val rangeInFile =
                                gson.fromJson<RangeInFile>(json, type)
                        highlightCode(rangeInFile, data["color"] as String)
                    }

                    "setSuggestionsLocked" -> {}
                    "getSessionId" -> {}
                    "highlightedCode" -> {
                        val rifWithContents = getHighlightedCode()
                        val rifs: MutableList<RangeInFile> = mutableListOf()
                        if (rifWithContents != null) {
                            val rif = RangeInFile(rifWithContents.filepath, rifWithContents.range)
                            rifs += rif
                        }
                        webSocket.send(
                                Gson().toJson(
                                        WebSocketMessage(
                                                "highlightedCode",
                                                messageId,
                                                HighlightedCode(rifs)
                                        )
                                )
                        )
                    }

                    else -> {
                        println("Unknown messageType: $messageType")
                    }
                }
            } catch (error: Exception) {
                showMessage("Error handling message of type $messageType: $error")
            }


            if (messageType != null) {
                pendingResponses[messageType]?.complete(parsedMessage)
                pendingResponses.remove(messageType)
            }
        }
    }

    private var backoff: Int = 100  // ms
    
    private fun initWebSocket() {
        val webSocketListener = object : WebSocketListener() {
    
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // handle onOpen
                backoff = 100  // reset backoff
            }
    
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleWebsocketMessage(webSocket, text)
            }
    
            override fun onFailure(
                    webSocket: WebSocket,
                    t: Throwable,
                    response: Response?
            ) {
                eventListeners.forEach { it.onErrorOccurred(t) }
                // handle failure
                backoff *= 2
                if (backoff > 10000000) return
                Thread.sleep(backoff.toLong())
                initWebSocket()
            }
    
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                super.onClosed(webSocket, code, reason)
                println("Closing Continue IDE websocket")
                // handle closure
                backoff *= 2
                if (backoff > 10000000) return
                Thread.sleep(backoff.toLong())
                initWebSocket()
            }
    
        }

        val request = Request.Builder()
                .url("${serverUrl}${if (sessionId != null) "?session_id=$sessionId" else ""}")
                .build()
    
        webSocket = okHttpClient.newWebSocket(request, webSocketListener)
    }

    fun addEventListener(listener: WebSocketEventListener) {
        eventListeners.add(listener)
    }

    fun connect() {
        // Connection is handled automatically by OkHttp
    }

    fun disconnect() {
        webSocket?.close(1000, null)
    }

    private fun sendMessage(messageType: String, message: Map<String, Any>) {
        val sendData = mapOf("messageType" to messageType, "data" to message)
        val jsonMessage = serializeMessage(sendData)
        webSocket?.send(jsonMessage)
    }

    fun workspaceDirectory(): String {
        return this.workspacePath
    }

    fun uniqueId(): String {
        return getMachineUniqueID()
    }

    fun onTextSelected(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ) = coroutineScope.launch {
//        val jsonMessage = textSelectionStrategy.handleTextSelection(
//            selectedText,
//            filepath,
//            startLine,
//            startCharacter,
//            endLine,
//            endCharacter
//        )
//        sendMessage("highlightedCodePush", jsonMessage)
//        dispatchEventToWebview(
//            "highlightedCode",
//            jsonMessage,
//            continuePluginService.continuePluginWindow.webView
//        )
    }

    fun readFile(filepath: String): String {
        val file =
            LocalFileSystem.getInstance().findFileByPath(filepath) ?: return ""
        val documentManager = FileDocumentManager.getInstance()
        val document = ApplicationManager.getApplication().runReadAction(Computable {
            documentManager.getDocument(file)
        })
        return document?.text ?: ""
    }

    fun getHighlightedCode(): RangeInFileWithContents? {
        val result = ApplicationManager.getApplication().runReadAction<RangeInFileWithContents?> {
            // Get the editor instance for the currently active editor window
            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@runReadAction null
            val virtualFile = editor.let { FileDocumentManager.getInstance().getFile(it.document) } ?: return@runReadAction null

            // Get the selection range and content
            val selectionModel: SelectionModel = editor.selectionModel
            val selectedText = selectionModel.selectedText ?: ""

            val document = editor.document
            val startOffset = selectionModel.selectionStart
            val endOffset = selectionModel.selectionEnd

            if (startOffset == endOffset) {
                return@runReadAction null
            }

            val startLine = document.getLineNumber(startOffset)
            val endLine = document.getLineNumber(endOffset)

            val startChar = startOffset - document.getLineStartOffset(startLine)
            val endChar = endOffset - document.getLineStartOffset(endLine)

            return@runReadAction RangeInFileWithContents(virtualFile.path, Range(
                    Position(startLine, startChar),
                    Position(endLine, endChar)
            ), selectedText)
        }

        return result
    }

    private fun<T> sendWebSocketMessage(messageType: String, messageId: String, data: T) {
        webSocket?.send(Gson().toJson(
                WebSocketMessage(messageType, messageId, data)
        ))
    }

    fun sendHighlightedCode(edit: Boolean = false) {
        val rif = getHighlightedCode() ?: return

        sendWebSocketMessage("highlightedCodePush", uuid(), HighlightedCodeUpdate(
                listOf(rif),
                edit
        ))
    }

    fun sendMainUserInput(input: String) {
        sendWebSocketMessage("mainUserInput", uuid(), MainUserInput(input))
    }

    fun sendAcceptRejectDiff(accepted: Boolean, stepIndex: Int) {
        sendWebSocketMessage("acceptRejectDiff", uuid(), AcceptRejectDiff(accepted, stepIndex))
    }

    fun deleteAtIndex(index: Int) {
        sendWebSocketMessage("deleteAtIndex", uuid(), DeleteAtIndex(index))
    }

    private val DEFAULT_IGNORE_DIRS = listOf(
            ".git",
            ".vscode",
            ".idea",
            ".vs",
            ".venv",
            "env",
            ".env",
            "node_modules",
            "dist",
            "build",
            "target",
            "out",
            "bin",
            ".pytest_cache",
            ".vscode-test",
            ".continue",
            "__pycache__"
    )
    private fun shouldIgnoreDirectory(name: String): Boolean {
        val components = File(name).path.split(File.separator)
        return DEFAULT_IGNORE_DIRS.any { dir ->
            components.contains(dir)
        }
    }


    fun listDirectoryContents(): List<String> {
        val workspacePath = File(workspaceDirectory())
        val workspaceDir = VirtualFileManager.getInstance().findFileByUrl("file://$workspacePath")

        val contents = ArrayList<String>()

        if (workspaceDir != null) {
            VfsUtil.iterateChildrenRecursively(workspaceDir, null) { virtualFile: VirtualFile ->
                if (!virtualFile.isDirectory) {
                    val filePath = virtualFile.path
                    if (!shouldIgnoreDirectory(filePath)) {
                        contents.add(filePath)
                    }
                }
                true
            }
        }

        return contents
    }

    fun saveFile(filepath: String) {
        ApplicationManager.getApplication().invokeLater {
            val file = LocalFileSystem.getInstance().findFileByPath(filepath) ?: return@invokeLater
            val fileDocumentManager = FileDocumentManager.getInstance()
            val document = fileDocumentManager.getDocument(file)

            document?.let {
                fileDocumentManager.saveDocument(it)
            }
        }
    }

    fun setFileOpen(filepath: String, open: Boolean = true) {
        val file = LocalFileSystem.getInstance().findFileByPath(filepath)

        file?.let {
            if (open) {
                ApplicationManager.getApplication().invokeLater {
                    FileEditorManager.getInstance(project).openFile(it, true)
                }
            } else {
                ApplicationManager.getApplication().invokeLater {
                    FileEditorManager.getInstance(project).closeFile(it)
                }
            }
        }
    }

    fun showVirtualFile(name: String, contents: String) {
        val virtualFile = LightVirtualFile(name, contents)
        ApplicationManager.getApplication().invokeLater {
            FileEditorManager.getInstance(project).openFile(virtualFile, true)
        }
    }

    fun visibleFiles(): List<String> {
        val fileEditorManager = FileEditorManager.getInstance(project)
        return fileEditorManager.openFiles.toList().map { it.path }
    }

    fun showMessage(msg: String) {
        val statusBar = WindowManager.getInstance().getStatusBar(project)

        JBPopupFactory.getInstance()
            .createHtmlTextBalloonBuilder(msg, MessageType.INFO, null)
            .setFadeoutTime(5000)
            .createBalloon()
            .show(
                RelativePoint.getSouthEastOf(statusBar.component),
                Balloon.Position.atRight
            )
    }

    fun highlightCode(rangeInFile: RangeInFile, color: String) {
        val file =
            LocalFileSystem.getInstance().findFileByPath(rangeInFile.filepath)

        setFileOpen(rangeInFile.filepath, true)

        ApplicationManager.getApplication().invokeLater {
            val editor = file?.let {
                val fileEditor =
                    FileEditorManager.getInstance(project).getSelectedEditor(it)
                (fileEditor as? TextEditor)?.editor
            }

            val virtualFile = LocalFileSystem.getInstance()
                .findFileByIoFile(File(rangeInFile.filepath))
            val document =
                FileDocumentManager.getInstance().getDocument(virtualFile!!)
            val startIdx =
                document!!.getLineStartOffset(rangeInFile.range.start.line) + rangeInFile.range.start.character
            val endIdx =
                document.getLineEndOffset(rangeInFile.range.end.line) + rangeInFile.range.end.character

            val markupModel = editor!!.markupModel
//            val textAttributes = TextAttributes(Color.decode(color.drop(1).toInt(color)), null, null, null, 0)

//            markupModel.addRangeHighlighter(startIdx, endIdx, 0, textAttributes, HighlighterTargetArea.EXACT_RANGE)
        }
    }
}

interface TextSelectionStrategy {
    fun handleTextSelection(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ): Map<String, Any>
}

class DefaultTextSelectionStrategy : TextSelectionStrategy {

    override fun handleTextSelection(
        selectedText: String,
        filepath: String,
        startLine: Int,
        startCharacter: Int,
        endLine: Int,
        endCharacter: Int
    ): Map<String, Any> {

        return mapOf(
            "edit" to false,
            "highlightedCode" to arrayOf(
                mapOf(
                    "filepath" to filepath,
                    "contents" to selectedText,
                    "range" to mapOf(
                        "start" to mapOf(
                            "line" to startLine,
                            "character" to startCharacter
                        ),
                        "end" to mapOf(
                            "line" to endLine,
                            "character" to endCharacter
                        )
                    )
                )
            )
        )
    }
}