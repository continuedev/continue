package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.*
import com.github.continuedev.continueintellijextension.constants.getConfigJsPath
import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.constants.getDevDataFilepath
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.MessageType
import com.intellij.openapi.ui.popup.Balloon
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.wm.WindowManager
import com.intellij.testFramework.LightVirtualFile
import com.intellij.ui.awt.RelativePoint
import kotlinx.coroutines.*
import net.minidev.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileReader
import java.io.FileWriter
import java.net.NetworkInterface
import java.nio.charset.Charset
import java.nio.file.Files
import java.nio.file.Paths
import java.util.*


fun uuid(): String {
    return UUID.randomUUID().toString()
}


data class IdeMessage<T>(val type: String, val messageId: String, val message: T)
data class Position(val line: Int, val character: Int)
data class Range(val start: Position, val end: Position)
data class RangeInFile(val filepath: String, val range: Range)
data class RangeInFileWithContents(val filepath: String, val range: Range, val contents: String)
data class HighlightedCodeUpdate(val highlightedCode: List<RangeInFileWithContents>, val edit: Boolean)
data class AcceptRejectDiff(val accepted: Boolean, val stepIndex: Int)
data class DeleteAtIndex(val index: Int)
data class MainUserInput(val input: String)

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

class IdeProtocolClient (
    private val continuePluginService: ContinuePluginService,
    private val textSelectionStrategy: TextSelectionStrategy,
    private val coroutineScope: CoroutineScope,
    private val workspacePath: String?,
    private val project: Project
): DumbAware {
    val diffManager = DiffManager(project)

    init {
        initIdeProtocol()
    }

    private fun send(messageType: String, data: Any?, messageId: String? = null) {
        val id = messageId ?: uuid()
        val message = IdeMessage(
                messageType,
                id,
                data
        )
        val json = Gson().toJson(message)
        continuePluginService.dispatchCustomEvent(json)
    }

    fun handleWebsocketMessage(text: String) {
        coroutineScope.launch(Dispatchers.IO) {
            val parsedMessage: Map<String, Any> = Gson().fromJson(
                    text,
                    object : TypeToken<Map<String, Any>>() {}.type
            )
            val messageType = parsedMessage["type"] as? String
            if (messageType == null) {
                println("Recieved message without type: $text")
                return@launch
            }
            val data = parsedMessage["data"] as Map<*, *>

            fun respond(responseData: Any?) {
                if (data["messageId"] == null) {
                    println("Recieved message without messageId: $text")
                    return
                }
                send(messageType, responseData, data["messageId"] as String);
            }

            val historyManager = HistoryManager()

            try {
                when (messageType) {
                    "uniqueId" -> respond(
                        mapOf("uniqueId" to uniqueId())
                    )

                    "ide" -> {
                        val applicationInfo = ApplicationInfo.getInstance()
                        val ideName: String = applicationInfo.fullApplicationName
                        val ideVersion = applicationInfo.fullVersion
                        val sshClient = System.getenv("SSH_CLIENT")
                        val sshTty = System.getenv("SSH_TTY")

                        var remoteName: String = "local"
                        if (sshClient != null || sshTty != null) {
                            remoteName = "ssh"
                        }
                        respond(mapOf(
                            "name" to ideName,
                            "version" to ideVersion,
                            "remoteName" to remoteName
                        ))
                    }

                    "showDiff" -> {
                        diffManager.showDiff(
                                data["filepath"] as String,
                                data["replacement"] as String,
                                (data["step_index"] as Double).toInt()
                        )
                    }

                    "readFile" -> {
                        val msg = readFile((data["message"] as Map<String, String>)["filepath"] as String)
                        respond(msg)
                    }

                    "listDirectoryContents" -> {
                        respond(
                            mapOf("contents" to listDirectoryContents())
                        )
                    }

                    "listWorkspaceContents" -> {
                        respond(listDirectoryContents())
                    }

                    "getWorkspaceDirs" -> {
                        respond(workspaceDirectories())
                    }

                    "getTerminalContents" -> {
                        respond(
                            mapOf("contents" to "Terminal cannot be accessed in JetBrains IDE")
                        )
                    }

                    "visibleFiles" -> {
                        respond(
                            mapOf("visibleFiles" to visibleFiles())
                        )
                    }

                    "saveFile" -> {
                        saveFile((data["message"] as Map<String, String>)["filepath"] ?: throw Exception("No filepath provided"))
                    }
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
                        respond(mapOf("highlightedCode" to rifs))
                    }


                    // NEW //
                    "getDiff" -> {
                        respond("");
                    }
                    "getSerializedConfig" -> {
                        val configPath = getConfigJsonPath()
                        val config = File(configPath).readText()
                        val mapType = object : TypeToken<Map<String, Any>>() {}.type
                        val parsed: Map<String, Any> = Gson().fromJson(config, mapType)
                        respond(parsed)
                    }
                    "getConfigJsUrl" -> {
                        // Calculate a data URL for the config.js file
                        val configJsPath = getConfigJsPath()
                        val configJsContents = File(configJsPath).readText()
                        val configJsDataUrl = "data:text/javascript;base64,${Base64.getEncoder().encodeToString(configJsContents.toByteArray())}"
                        respond(configJsDataUrl)
                    }
                    "writeFile" -> {
                        val msg = data["message"] as Map<String, String>;
                        val file = File(msg["path"])
                        file.writeText(msg["contents"] as String)
                        respond(null);
                    }
                    "getContinueDir" -> {
                        respond(getContinueGlobalPath())
                    }
                    "openFile" -> {
                        setFileOpen((data["message"] as Map<String, Any>)["path"] as String)
                        respond(null)
                    }
                    "runCommand" -> {
                        respond(null)
                        // Running commands not yet supported in JetBrains
                    }
                    "errorPopup" -> {
                        showMessage(data["message"] as String)
                    }

                    // History
                    "history" -> {
                        respond(historyManager.list());
                    }
                    "saveSession" -> {
                        historyManager.save(data["message"] as PersistedSessionInfo);
                        respond(null);
                    }
                    "deleteSession" -> {
                        historyManager.delete(data["message"] as String);
                        respond(null);
                    }
                    "loadSession" -> {
                        val session = historyManager.load(data["message"] as String)
                        respond(session)
                    }

                    // Other
                    "getOpenFiles" -> {
                        val openFiles = visibleFiles()
                        respond(openFiles)
                    }
                    "logDevData" -> {
                        val filename = data["tableName"] as String
                        val jsonLine = data["data"]
                        val filepath = getDevDataFilepath(filename)
                        val contents = Gson().toJson(jsonLine) + "\n"
                        File(filepath).appendText(contents)
                    }
                    "addModel" -> {
                        val model = data["model"] as Map<String, Any>
                        val updatedConfig = editConfigJson {
                            val models = it["models"] as MutableList<Map<String, Any>>
                            models.add(model)
                            it
                        }

                        configUpdate(updatedConfig)
                        setFileOpen(getConfigJsonPath())
                    }
                    "deleteModel" -> {
                        val configJson = editConfigJson { config ->
                            var models: MutableList<Map<String, Any>> = config["models"] as MutableList<Map<String, Any>>

                            val model = data["title"] as String
                            models = models.filter { it["title"] != model }.toMutableList()
                            config["models"] = models
                            config
                        }
                        configUpdate(configJson)
                    }
                    "addOpenAIKey" -> {
                        val updatedConfig = editConfigJson { config ->
                            val key = data["key"] as String
                            var models = config["models"] as MutableList<MutableMap<String, Any>>
                            models = models.map {
                                if (it["provider"] == "openai-free-trial") {
                                    it["apiKey"] = key
                                    it["provider"] = "openai"
                                    it
                                } else {
                                    it
                                }
                            }.toMutableList()
                            config["models"] = models
                            config
                        }
                        configUpdate(updatedConfig)
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

    private fun configUpdate(config: Map<String, Any>) {
        val data = mapOf(
            "type" to "configUpdate",
            "config" to config
        )
        val json = Gson().toJson(data)
        continuePluginService.dispatchCustomEvent(json)
    }

    private fun editConfigJson(callback: (config: MutableMap<String, Any>) -> Map<String, Any>): Map<String, Any> {
        val gson = GsonBuilder().setPrettyPrinting().create()
        val configJsonPath = getConfigJsonPath()
        val reader = FileReader(configJsonPath)
        val config: MutableMap<String, Any> = gson.fromJson(
                reader,
                object : TypeToken<Map<String, Any>>() {}.type
        )
        reader.close()

        val editedConfig = callback(config)

        val writer = FileWriter(configJsonPath)
        gson.toJson(editedConfig, writer)
        writer.close()

        return editedConfig
    }

    private fun initIdeProtocol() {
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
            "unique_id" to uniqueId(),
            "ide_info" to IDEInfo(
                name = ideName,
                version = ideVersion,
                remote_name = remoteName ?: ""
            ),
        )
    }

    private fun workspaceDirectories(): Array<String> {
        if (this.workspacePath != null) {
            return arrayOf(this.workspacePath)
        }
        return arrayOf<String>();
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
        try {
            val file = File(filepath)
            if (!file.exists()) return ""

            FileInputStream(file).use { fis ->
                val sizeToRead = minOf(100000, file.length()).toInt()
                val buffer = ByteArray(sizeToRead)
                val bytesRead = fis.read(buffer, 0, sizeToRead)
                if (bytesRead <= 0) return ""

                // Here we assume the file encoding is UTF-8; adjust as necessary for different encodings.
                return String(buffer, 0, bytesRead, Charset.forName("UTF-8"))
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return ""
        }
    }

    fun readRangeInFile(rangeInFile: RangeInFile): String {
        return "TODO"
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

//        send("highlightedCodePush", uuid(), HighlightedCodeUpdate(
//                listOf(rif),
//                edit
//        ))

        continuePluginService.dispatchCustomEvent(
            Gson().toJson(mapOf(
                "type" to "highlightedCode",
                "rangeInFileWithContents" to rif,
                "edit" to edit
            )))
    }

    fun sendMainUserInput(input: String) {
        val data = mapOf(
                "type" to "userInput",
                "input" to input,
        )
        continuePluginService.dispatchCustomEvent(Gson().toJson(data))
    }

    fun sendAcceptRejectDiff(accepted: Boolean, stepIndex: Int) {
        send("acceptRejectDiff", AcceptRejectDiff(accepted, stepIndex), uuid())
    }

    fun deleteAtIndex(index: Int) {
        send("deleteAtIndex", DeleteAtIndex(index), uuid())
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
        val dirs = workspaceDirectories()
        val contents = ArrayList<String>()

        for (dir in dirs) {
            val workspacePath = File(dir)
            val workspaceDir = VirtualFileManager.getInstance().findFileByUrl("file://$workspacePath")



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

    private fun visibleFiles(): List<String> {
        val fileEditorManager = FileEditorManager.getInstance(project)
        return fileEditorManager.openFiles.toList().map { it.path }
    }

    private fun showMessage(msg: String) {
        val statusBar = WindowManager.getInstance().getStatusBar(project)

        JBPopupFactory.getInstance()
            .createHtmlTextBalloonBuilder(msg, MessageType.INFO, null)
            .setFadeoutTime(10000)
            .setHideOnAction(false)
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