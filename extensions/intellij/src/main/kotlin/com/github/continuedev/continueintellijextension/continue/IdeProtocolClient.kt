package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.activities.getContinueServerUrl
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
import java.net.URI
import java.util.*
import io.socket.client.IO
import io.socket.client.Socket
import java.net.URLEncoder

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
    private val continuePluginService: ContinuePluginService,
    private val textSelectionStrategy: TextSelectionStrategy,
    private val coroutineScope: CoroutineScope,
    private val workspacePath: String,
    private val project: Project
) {
    private var webSocket: WebSocket? = null

    private var socket: Socket? = null

    val diffManager = DiffManager(project)

    init {
        initWebSocket()
    }

    private fun serializeMessage(data: Map<String, Any>): String {
        val gson = Gson()
        return gson.toJson(data)
    }

    private fun send(messageType: String, messageId: String, data: Any) {
        val wsMessage = WebSocketMessage(
                messageType,
                messageId,
                data
        )
        socket?.send("message", Gson().toJson(wsMessage))
    }

    private fun handleWebsocketMessage(text: String) {
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
                        send("workspaceDirectory", messageId, WorkspaceDirectory(workspaceDirectory()))
                    }

                    "uniqueId" -> send(
                        "uniqueId",
                        messageId,
                        UniqueId(uniqueId())
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
                        send(
                            "ide",
                            messageId,
                            IdeInfo(ideName, ideVersion, remoteName)
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
                        send(
                            "readFile",
                            messageId,
                            msg
                        )
                    }

                    "listDirectoryContents" -> {
                        send(
                            "listDirectoryContents",
                            messageId,
                            ListDirectoryContents(listDirectoryContents())
                        )
                    }

                    "getTerminalContents" -> {
                        send(
                            "getTerminalContents",
                            messageId,
                            GetTerminalContents("Terminal cannot be accessed in JetBrains IDE")
                        )
                    }

                    "visibleFiles" -> {
                        val msg = VisibleFiles(visibleFiles())
                        send(
                            "visibleFiles",
                            messageId,
                            msg
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
                        send(
                            "highlightedCode",
                            messageId,
                            HighlightedCode(rifs)
                        )
                    }

                    else -> {
                        println("Unknown messageType: $messageType")
                    }
                }
            } catch (error: Exception) {
                showMessage("Error handling message of type $messageType: $error")
            }
        }
    }

    private fun initWebSocket() {
        val applicationInfo = ApplicationInfo.getInstance()
        val ideName: String = applicationInfo.fullApplicationName
        val ideVersion = applicationInfo.fullVersion
        val sshClient = System.getenv("SSH_CLIENT")
        val sshTty = System.getenv("SSH_TTY")

        var remoteName: String? = null
        if (sshClient != null || sshTty != null) {
            remoteName = "ssh"
        }
        data class IDEInfo(
            val name: String,
            val version: String,
            val remote_name: String
        )

        val windowInfo = mapOf(
                "window_id" to continuePluginService.windowId,
                "workspace_directory" to workspaceDirectory(),
                "unique_id" to uniqueId(),
                "ide_info" to IDEInfo(
                    name = ideName,
                    version = ideVersion,
                    remote_name = remoteName ?: ""
                )
        )

        val requestUrl = "${getContinueServerUrl()}/?window_info=${
            URLEncoder.encode(
                Gson().toJson(windowInfo), "UTF-8"
        )}"

        val uri: URI = URI.create(requestUrl)
        val options: IO.Options = IO.Options.builder()
                .setPath("/ide/socket.io")
                .setTransports(arrayOf("websocket", "polling", "flashsocket"))
                .build()

        val socket: Socket = IO.socket(uri, options)

        socket.on(Socket.EVENT_CONNECT) {
            println("Connected to Continue IDE websocket")
        }

        socket.on(Socket.EVENT_DISCONNECT) {
            println("Disconnected from Continue IDE websocket")
        }

        socket.on(Socket.EVENT_CONNECT_ERROR) {
            println("Error connecting to Continue IDE websocket")
        }

        socket.on("message") { args ->
            val data = args[0] as String
            println("Received message: $data")
            handleWebsocketMessage(data)
        }

        socket.connect()
        this.socket = socket
    }


    private fun sendMessage(messageType: String, message: Map<String, Any>) {
        val sendData = mapOf("messageType" to messageType, "data" to message)
        val jsonMessage = serializeMessage(sendData)
        webSocket?.send(jsonMessage)
    }

    private fun workspaceDirectory(): String {
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

    private fun getHighlightedCode(): RangeInFileWithContents? {
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

    fun sendHighlightedCode(edit: Boolean = false) {
        val rif = getHighlightedCode() ?: return

        send("highlightedCodePush", uuid(), HighlightedCodeUpdate(
                listOf(rif),
                edit
        ))
    }

    fun sendMainUserInput(input: String) {
        send("mainUserInput", uuid(), MainUserInput(input))
    }

    fun sendAcceptRejectDiff(accepted: Boolean, stepIndex: Int) {
        send("acceptRejectDiff", uuid(), AcceptRejectDiff(accepted, stepIndex))
    }

    fun deleteAtIndex(index: Int) {
        send("deleteAtIndex", uuid(), DeleteAtIndex(index))
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


    private fun listDirectoryContents(): List<String> {
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

    private fun saveFile(filepath: String) {
        ApplicationManager.getApplication().invokeLater {
            val file = LocalFileSystem.getInstance().findFileByPath(filepath) ?: return@invokeLater
            val fileDocumentManager = FileDocumentManager.getInstance()
            val document = fileDocumentManager.getDocument(file)

            document?.let {
                fileDocumentManager.saveDocument(it)
            }
        }
    }

    private fun setFileOpen(filepath: String, open: Boolean = true) {
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

    private fun visibleFiles(): List<String> {
        val fileEditorManager = FileEditorManager.getInstance(project)
        return fileEditorManager.openFiles.toList().map { it.path }
    }

    private fun showMessage(msg: String) {
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

    private fun highlightCode(rangeInFile: RangeInFile, color: String) {
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