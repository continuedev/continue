package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.constants.*
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.Disposable
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
import com.intellij.openapi.vfs.*
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.wm.WindowManager
import com.intellij.testFramework.LightVirtualFile
import com.intellij.ui.awt.RelativePoint
import kotlinx.coroutines.*
import java.io.*
import java.net.NetworkInterface
import java.nio.charset.Charset
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

private fun readConfigJson(): Map<String, Any> {
    val gson = GsonBuilder().setPrettyPrinting().create()
    val configJsonPath = getConfigJsonPath()
    val reader = FileReader(configJsonPath)
    val config: Map<String, Any> = gson.fromJson(
            reader,
            object : TypeToken<Map<String, Any>>() {}.type
    )
    reader.close()
    return config
}

class AsyncFileSaveListener : AsyncFileListener {
    private val ideProtocolClient: IdeProtocolClient

    constructor(ideProtocolClient: IdeProtocolClient) {
        this.ideProtocolClient = ideProtocolClient
    }
    override fun prepareChange(events: MutableList<out VFileEvent>): AsyncFileListener.ChangeApplier? {
        for (event in events) {
            if (event.path.endsWith(".continue/config.json") || event.path.endsWith(".continue/config.ts") || event.path.endsWith(".continue\\config.json") || event.path.endsWith(".continue\\config.ts") || event.path.endsWith(".continuerc.json")) {
                return object : AsyncFileListener.ChangeApplier {
                    override fun afterVfsChange() {
                        val config = readConfigJson()
                        ideProtocolClient.configUpdate(config)
                    }
                }
            }
        }
        return null
    }

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

        // Setup config.json / config.ts save listeners
        VirtualFileManager.getInstance().addAsyncFileListener(AsyncFileSaveListener(this), object : Disposable {
            override fun dispose() {}
        })
    }

    private fun send(messageType: String, data: Any?, messageId: String? = null) {
        val id = messageId ?: uuid()
        continuePluginService.sendToWebview(messageType, data, id)
    }

    fun handleMessage(text: String, respond: (Any?) -> Unit) {
        coroutineScope.launch(Dispatchers.IO) {
            val parsedMessage: Map<String, Any> = Gson().fromJson(
                    text,
                    object : TypeToken<Map<String, Any>>() {}.type
            )
            val messageType = parsedMessage["messageType"] as? String
            if (messageType == null) {
                println("Recieved message without type: $text")
                return@launch
            }
            val data = parsedMessage["data"]

            val historyManager = HistoryManager()

            try {
                when (messageType) {
                    "uniqueId" -> respond(
                        mapOf("uniqueId" to uniqueId())
                    )

                    "getIdeInfo" -> {
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
                            "ideType" to "jetbrains",
                            "name" to ideName,
                            "version" to ideVersion,
                            "remoteName" to remoteName
                        ))
                    }

                    "getUniqueId" -> {
                        respond(uniqueId())
                    }

                    "showDiff" -> {
                        val data = data as Map<String, Any>
                        diffManager.showDiff(
                                data["filepath"] as String,
                                data["newContents"] as String,
                                (data["stepIndex"] as Double).toInt()
                        )
                        respond(null)
                    }

                    "readFile" -> {
                        val msg = readFile((data as Map<String, String>)["filepath"] as String)
                        respond(msg)
                    }

                    "isTelemetryEnabled" -> {
                        respond(true)
                    }

                    "readRangeInFile" -> {
                        val fullContents = readFile((data as Map<String, String>)["filepath"] as String)
                        val range = data["range"] as Map<String, Any>
                        val start = range["start"] as Map<String, Any>
                        val end = range["end"] as Map<String, Any>
                        val startLine = start["line"] as Int
                        val startCharacter = start["character"] as Int
                        val endLine = end["line"] as Int
                        val endCharacter = end["character"] as Int

                        val firstLine = fullContents.split("\n")[startLine].slice(startCharacter until fullContents.split("\n")[startLine].length)
                        val lastLine = fullContents.split("\n")[endLine].slice(0 until endCharacter)
                        val between = fullContents.split("\n").slice(startLine + 1 until endLine).joinToString("\n")

                        respond(firstLine + "\n" + between + "\n" + lastLine)
                    }

                    "listWorkspaceContents" -> {
                        respond(listDirectoryContents(null))
                    }

                    "getWorkspaceDirs" -> {
                        respond(workspaceDirectories())
                    }

                    "getWorkspaceConfigs" -> {
                        respond(emptyList<String>())
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
                        saveFile((data as Map<String, String>)["filepath"] ?: throw Exception("No filepath provided"))
                        respond(null)
                    }
                    "showVirtualFile" -> {
                        val data = data as Map<String, Any>
                        showVirtualFile(
                            data["name"] as String,
                            data["contents"] as String
                        )
                        respond(null)
                    }

                    "connected" -> {}
                    "showMessage" -> {
                        showMessage(data as String)
                        respond(null)
                    }
                    "setFileOpen" -> {
                        val data = data as Map<String, Any>
                        setFileOpen(
                                data["filepath"] as String,
                                data["open"] as Boolean
                        )
                        respond(null)
                    }

                    "showLines" -> {
                        val data = data as Map<String, Any>
                        val filepath = data["filepath"] as String
                        val startLine = data["startLine"] as Int
                        val endLine = data["endLine"] as Int
                        highlightCode(
                                RangeInFile(
                                        filepath,
                                        Range(
                                                Position(startLine, 0),
                                                Position(endLine, 0)
                                        )
                                ),
                                data["color"] as String
                        )
                        respond(null)
                    }

                    "highlightCode" -> {
                        val gson = Gson()
                        val data = data as Map<String, Any>
                        val json = gson.toJson(data["rangeInFile"])
                        val type = object : TypeToken<RangeInFile>() {}.type
                        val rangeInFile =
                                gson.fromJson<RangeInFile>(json, type)
                        highlightCode(rangeInFile, data["color"] as String)
                        respond(null)
                    }

                    "setSuggestionsLocked" -> {}
                    "getSessionId" -> {}

                    // NEW //
                    "getDiff" -> {
                        val builder = ProcessBuilder("git", "diff")
                        builder.directory(File(workspacePath ?: "."))
                        val process = builder.start()

                        val reader = BufferedReader(InputStreamReader(process.inputStream))
                        val output = StringBuilder()
                        var line: String? = reader.readLine()
                        while (line != null) {
                            output.append(line)
                            output.append("\n")
                            line = reader.readLine()
                        }

                        process.waitFor()

                        respond(output.toString());
                    }
                    "getConfigJsUrl" -> {
                        // Calculate a data URL for the config.js file
                        val configJsPath = getConfigJsPath()
                        val configJsContents = File(configJsPath).readText()
                        val configJsDataUrl = "data:text/javascript;base64,${Base64.getEncoder().encodeToString(configJsContents.toByteArray())}"
                        respond(configJsDataUrl)
                    }
                    "writeFile" -> {
                        val msg = data as Map<String, String>;
                        val file = File(msg["path"])
                        file.writeText(msg["contents"] as String)
                        respond(null);
                    }
                    "getContinueDir" -> {
                        respond(getContinueGlobalPath())
                    }
                    "openFile" -> {
                        setFileOpen((data as Map<String, Any>)["path"] as String)
                        respond(null)
                    }
                    "runCommand" -> {
                        respond(null)
                        // Running commands not yet supported in JetBrains
                    }
                    "errorPopup" -> {
                        val data = data as Map<String, Any>
                        val message = data["message"] as String
                        showMessage(message)
                        respond(null)
                    }

                    "listFolders" -> {
                        respond(null)
                    }

                    // History
                    "history" -> {
                        respond(historyManager.list());
                    }
                    "saveSession" -> {
                        historyManager.save(data as PersistedSessionInfo);
                        respond(null);
                    }
                    "deleteSession" -> {
                        historyManager.delete(data as String);
                        respond(null);
                    }
                    "loadSession" -> {
                        val session = historyManager.load(data as String)
                        respond(session)
                    }
                    "getSearchResults" -> {
                        respond("")
                    }

                    // Other
                    "getOpenFiles" -> {
                        val openFiles = visibleFiles()
                        respond(openFiles)
                    }
                    "getPinnedFiles" -> {
                        val openFiles = visibleFiles()
                        respond(openFiles)
                    }
                    "logDevData" -> {
                        val data = data as Map<String, Any>
                        val filename = data["tableName"] as String
                        val jsonLine = data["data"]
                        val filepath = getDevDataFilepath(filename)
                        val contents = Gson().toJson(jsonLine) + "\n"
                        File(filepath).appendText(contents)
                    }
                    "addModel" -> {
                        val data = data as Map<String, Any>
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
                            val data = data as Map<String, Any>
                            val model = data["title"] as String
                            models = models.filter { it["title"] != model }.toMutableList()
                            config["models"] = models
                            config
                        }
                        configUpdate(configJson)
                    }
                    "addOpenAIKey" -> {
                        val updatedConfig = editConfigJson { config ->
                            val data = data as Map<String, Any>
                            val key = data["key"] as String
                            var models = config["models"] as MutableList<MutableMap<String, Any>>
                            models = models.map {
                                if (it["provider"] == "free-trial") {
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

    fun configUpdate(config: Map<String, Any>) {
        continuePluginService.coreMessenger?.request("config/reload", null, null) { _ -> }
        continuePluginService.sendToWebview("configUpdate", config)
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

        continuePluginService.sendToWebview(
"highlightedCode",
           mapOf(
                "rangeInFileWithContents" to rif,
                "edit" to edit
            )
        )
    }

    fun sendMainUserInput(input: String) {
        continuePluginService.sendToWebview("userInput", mapOf("input" to input))
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
            "venv",
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

    private fun workspaceDirectories(): Array<String> {
        if (this.workspacePath != null) {
            return arrayOf(this.workspacePath)
        }
        return arrayOf<String>();
    }

    private fun listDirectoryContents(directory: String?): List<String> {
        val dirs: Array<String>;
        if (directory != null) {
            dirs = arrayOf(directory)
        } else {
            dirs = workspaceDirectories()
        }

        val contents = ArrayList<String>()
        for (dir in dirs) {
            val workspacePath = File(dir)
            val workspaceDir = VirtualFileManager.getInstance().findFileByUrl("file://$workspacePath")

            if (workspaceDir != null) {
                VfsUtil.iterateChildrenRecursively(workspaceDir, null) { virtualFile: VirtualFile ->
                    if (virtualFile.isDirectory) {
//                        if (shouldIgnoreDirectory(virtualFile.name)) {
//
//                        }
                    } else {
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

    fun showMessage(msg: String) {
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