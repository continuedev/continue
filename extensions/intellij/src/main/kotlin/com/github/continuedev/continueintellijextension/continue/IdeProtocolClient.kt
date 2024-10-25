package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.auth.AuthListener
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.constants.getConfigJsPath
import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.util.ExecUtil
import com.intellij.ide.plugins.PluginManager
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.notification.NotificationType
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.editor.impl.DocumentMarkupModel
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.vfs.*
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.psi.PsiDocumentManager
import com.intellij.testFramework.LightVirtualFile
import com.intellij.util.concurrency.annotations.RequiresEdt
import kotlinx.coroutines.*
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.io.*
import java.net.NetworkInterface
import java.nio.charset.Charset
import java.nio.file.Paths
import java.util.*

fun uuid(): String {
    return UUID.randomUUID().toString()
}

data class Position(val line: Int, val character: Int)
data class Range(val start: Position, val end: Position)
data class RangeInFile(val filepath: String, val range: Range)
data class RangeInFileWithContents(val filepath: String, val range: Range, val contents: String)
data class AcceptRejectDiff(val accepted: Boolean, val stepIndex: Int)
data class DeleteAtIndex(val index: Int)

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

class AsyncFileSaveListener(private val ideProtocolClient: IdeProtocolClient) : AsyncFileListener {
    override fun prepareChange(events: MutableList<out VFileEvent>): AsyncFileListener.ChangeApplier? {
        for (event in events) {
            if (event.path.endsWith(".continue/config.json") || event.path.endsWith(".continue/config.ts") || event.path.endsWith(
                    ".continue\\config.json"
                ) || event.path.endsWith(".continue\\config.ts") || event.path.endsWith(".continuerc.json")
            ) {
                return object : AsyncFileListener.ChangeApplier {
                    override fun afterVfsChange() {
                        val config = readConfigJson()
                        ideProtocolClient.configUpdate()
                    }
                }
            }
        }
        return null
    }
}

class IdeProtocolClient(
    private val continuePluginService: ContinuePluginService,
    private val coroutineScope: CoroutineScope,
    private val workspacePath: String?,
    private val project: Project
) : DumbAware {
    val diffManager = DiffManager(project)
    private val ripgrep: String

    init {
        initIdeProtocol()

        // Setup config.json / config.ts save listeners
        VirtualFileManager.getInstance().addAsyncFileListener(AsyncFileSaveListener(this), object : Disposable {
            override fun dispose() {}
        })

        val myPluginId = "com.github.continuedev.continueintellijextension"
        val pluginDescriptor =
            PluginManager.getPlugin(PluginId.getId(myPluginId)) ?: throw Exception("Plugin not found")

        val pluginPath = pluginDescriptor.pluginPath
        val osName = System.getProperty("os.name").toLowerCase()
        val os = when {
            osName.contains("mac") || osName.contains("darwin") -> "darwin"
            osName.contains("win") -> "win32"
            osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> "linux"
            else -> "linux"
        }

        ripgrep =
            Paths.get(pluginPath.toString(), "ripgrep", "bin", "rg" + (if (os == "win32") ".exe" else "")).toString()
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
                println("Received message without type: $text")
                return@launch
            }
            val data = parsedMessage["data"]

            try {
                when (messageType) {
                    "uniqueId" -> respond(
                        mapOf("uniqueId" to uniqueId())
                    )

                    "getIdeSettings" -> {
                        val settings =
                            ServiceManager.getService(ContinueExtensionSettings::class.java)
                        respond(
                            mapOf(
                                "remoteConfigServerUrl" to settings.continueState.remoteConfigServerUrl,
                                "remoteConfigSyncPeriod" to settings.continueState.remoteConfigSyncPeriod,
                                "userToken" to settings.continueState.userToken,
                                "enableControlServerBeta" to settings.continueState.enableContinueTeamsBeta
                            )
                        )
                    }

                    "getControlPlaneSessionInfo" -> {
                        val silent = (data as? Map<String, Any>)?.get("silent") as? Boolean ?: false

                        val authService = service<ContinueAuthService>()
                        if (silent) {
                            val sessionInfo = authService.loadControlPlaneSessionInfo()
                            respond(sessionInfo)
                        } else {
                            authService.startAuthFlow(project)
                            respond(null)
                        }
                    }

                    "logoutOfControlPlane" -> {
                        val authService = service<ContinueAuthService>()
                        authService.signOut()
                        ApplicationManager.getApplication().messageBus.syncPublisher(AuthListener.TOPIC)
                            .handleUpdatedSessionInfo(null)
                        respond(null)
                    }

                    "getIdeInfo" -> {
                        val applicationInfo = ApplicationInfo.getInstance()
                        val ideName: String = applicationInfo.fullApplicationName
                        val ideVersion = applicationInfo.fullVersion
                        val sshClient = System.getenv("SSH_CLIENT")
                        val sshTty = System.getenv("SSH_TTY")

                        var remoteName = "local"
                        if (sshClient != null || sshTty != null) {
                            remoteName = "ssh"
                        }

                        val pluginId = "com.github.continuedev.continueintellijextension"
                        val plugin = PluginManagerCore.getPlugin(PluginId.getId(pluginId))
                        val extensionVersion = plugin?.version ?: "Unknown"

                        respond(
                            mapOf(
                                "ideType" to "jetbrains",
                                "name" to ideName,
                                "version" to ideVersion,
                                "remoteName" to remoteName,
                                "extensionVersion" to extensionVersion
                            )
                        )
                    }

                    "getUniqueId" -> {
                        respond(uniqueId())
                    }

                    "copyText" -> {
                        val data = data as Map<String, Any>
                        val text = data["text"] as String
                        val clipboard = Toolkit.getDefaultToolkit().systemClipboard
                        val stringSelection = StringSelection(text)
                        clipboard.setContents(stringSelection, stringSelection)
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

                        val firstLine =
                            fullContents.split("\n")[startLine].slice(startCharacter until fullContents.split("\n")[startLine].length)
                        val lastLine = fullContents.split("\n")[endLine].slice(0 until endCharacter)
                        val between = fullContents.split("\n").slice(startLine + 1 until endLine).joinToString("\n")

                        respond(firstLine + "\n" + between + "\n" + lastLine)
                    }

                    "getWorkspaceDirs" -> {
                        respond(workspaceDirectories())
                    }

                    "getTags" -> {
                        val artifactId = data as? String
                        if (artifactId == null) {
                            respond(emptyList<Any>())
                            return@launch
                        }
                        val tags = getTags(artifactId)
                        respond(tags)
                    }

                    "getWorkspaceConfigs" -> {
                        val workspaceDirs = workspaceDirectories()

                        val configs = mutableListOf<String>()
                        for (workspaceDir in workspaceDirs) {
                            val workspacePath = File(workspaceDir)
                            val dir = VirtualFileManager.getInstance().findFileByUrl("file://$workspacePath")
                            if (dir != null) {
                                val contents = dir.children.map { it.name }

                                // Find any .continuerc.json files
                                for (file in contents) {
                                    if (file.endsWith(".continuerc.json")) {
                                        val filePath = workspacePath.resolve(file)
                                        val fileContent = File(filePath.toString()).readText()
                                        configs.add(fileContent)
                                    }
                                }
                            }
                        }
                        respond(configs)
                    }

                    "getTerminalContents" -> {
                        respond(terminalContents())
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
                        val startLine = (data["startLine"] as Double).toInt()
                        val endLine = (data["endLine"] as Double).toInt()
                        highlightCode(
                            RangeInFile(
                                filepath,
                                Range(
                                    Position(startLine, 0),
                                    Position(endLine, 0)
                                )
                            ),
                            data["color"] as String?
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

                    "getLastModified" -> {
                        // TODO
                        val data = data as Map<String, Any>
                        val files = data["files"] as List<String>
                        val pathToLastModified = files.map { file ->
                            file to File(file).lastModified()
                        }.toMap()
                        respond(pathToLastModified)
                    }

                    "listDir" -> {
                        val data = data as Map<String, Any>
                        val dir = data["dir"] as String
                        // List of [file, FileType]
                        val files: List<List<Any>> = File(dir).listFiles()?.map {
                            listOf(it.name, if (it.isDirectory) 2 else 1)
                        } ?: emptyList()
                        respond(files)
                    }

                    "getGitRootPath" -> {
                        val data = data as Map<String, Any>
                        val directory = data["dir"] as String
                        val builder = ProcessBuilder("git", "rev-parse", "--show-toplevel")
                        builder.directory(File(directory))
                        val process = builder.start()

                        val reader = BufferedReader(InputStreamReader(process.inputStream))
                        val output = reader.readLine()
                        process.waitFor()

                        respond(output)
                    }

                    "getBranch" -> {
                        // Get the current branch name
                        val dir = (data as Map<String, Any>)["dir"] as String
                        val branch = getBranch(dir)
                        respond(branch)
                    }

                    "getRepoName" -> {
                        // Get the current repository name
                        val dir = (data as Map<String, Any>)["dir"] as String
                        val builder = ProcessBuilder("git", "config", "--get", "remote.origin.url")
                        builder.directory(File(dir))
                        var output = "NONE"
                        try {
                            val process = builder.start()

                            val reader = BufferedReader(InputStreamReader(process.inputStream))
                            output = reader.readLine()
                            process.waitFor()
                        } catch (error: Exception) {
                            println("Git not found: " + error)
                        }

                        respond(output)
                    }

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

                    "getProblems" -> {
                        // Get currently active editor
                        var editor: Editor? = null
                        ApplicationManager.getApplication().invokeAndWait {
                            editor = FileEditorManager.getInstance(project).selectedTextEditor
                        }
                        if (editor == null) {
                            respond(emptyList<Map<String, Any?>>())
                            return@launch
                        }
                        val project = editor!!.project ?: return@launch
                        ApplicationManager.getApplication().invokeLater {
                            val document = editor!!.document
                            val psiFile =
                                PsiDocumentManager.getInstance(project).getPsiFile(document) ?: return@invokeLater
                            val problems = ArrayList<Map<String, Any?>>()
                            val highlightInfos =
                                DocumentMarkupModel.forDocument(document, project, true).allHighlighters.mapNotNull(
                                    HighlightInfo::fromRangeHighlighter
                                )
                            for (highlightInfo in highlightInfos) {
                                if (highlightInfo.severity === HighlightSeverity.ERROR ||
                                    highlightInfo.severity === HighlightSeverity.WARNING
                                ) {
                                    val startOffset = highlightInfo.getStartOffset()
                                    val endOffset = highlightInfo.getEndOffset()
                                    val description = highlightInfo.description
                                    problems.add(
                                        mapOf(
                                            "filepath" to psiFile.virtualFile?.path,
                                            "range" to mapOf(
                                                "start" to mapOf(
                                                    "line" to document.getLineNumber(startOffset),
                                                    "character" to startOffset - document.getLineStartOffset(
                                                        document.getLineNumber(
                                                            startOffset
                                                        )
                                                    )
                                                ),
                                                "end" to mapOf(
                                                    "line" to document.getLineNumber(endOffset),
                                                    "character" to endOffset - document.getLineStartOffset(
                                                        document.getLineNumber(
                                                            endOffset
                                                        )
                                                    )
                                                )
                                            ),
                                            "message" to description
                                        )
                                    )
                                }
                            }
                            respond(problems)
                        }
                    }

                    "getConfigJsUrl" -> {
                        // Calculate a data URL for the config.js file
                        val configJsPath = getConfigJsPath()
                        val configJsContents = File(configJsPath).readText()
                        val configJsDataUrl = "data:text/javascript;base64,${
                            Base64.getEncoder().encodeToString(configJsContents.toByteArray())
                        }"
                        respond(configJsDataUrl)
                    }

                    "writeFile" -> {
                        val msg = data as Map<String, String>;
                        val file = File(msg["path"])
                        file.writeText(msg["contents"] as String)
                        respond(null);
                    }

                    "fileExists" -> {
                        val msg = data as Map<String, String>;
                        val file = File(msg["filepath"])
                        respond(file.exists())
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

                    "showToast" -> {
                        val data = data as ArrayList<String>
                        val toastType = data[0]
                        val message = data[1]
                        val buttons = data.drop(2).toTypedArray()

                        val result = showToast(toastType, message, buttons)
                        respond(result)
                    }

                    "listFolders" -> {
                        val workspacePath = workspacePath ?: return@launch
                        val workspaceDir = File(workspacePath)
                        val folders =
                            workspaceDir.listFiles { file -> file.isDirectory }?.map { file -> file.absolutePath }
                                ?: emptyList()
                        respond(folders)
                    }

                    "getSearchResults" -> {
                        val query = (data as Map<String, Any>)["query"] as String
                        respond(search(query))
                    }

                    // Other
                    "getOpenFiles" -> {
                        val openFiles = visibleFiles()
                        respond(openFiles)
                    }

                    "getCurrentFile" -> {
                        val currentFile = currentFile()
                        respond(currentFile)
                    }

                    "getPinnedFiles" -> {
                        ApplicationManager.getApplication().invokeLater {
                            val pinnedFiles = pinnedFiles()
                            respond(pinnedFiles)
                        }
                    }

                    "insertAtCursor" -> {
                        val msg = data as Map<String, String>;
                        val text = msg["text"] as String
                        ApplicationManager.getApplication().invokeLater {
                            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@invokeLater
                            val selectionModel: SelectionModel = editor.selectionModel

                            val document = editor.document
                            val startOffset = selectionModel.selectionStart
                            val endOffset = selectionModel.selectionEnd

                            WriteCommandAction.runWriteCommandAction(project) {
                                document.replaceString(startOffset, endOffset, text)
                            }
                        }
                    }

                    "applyToFile" -> {
                    }

                    "getGitHubAuthToken" -> {
                        val continueSettingsService = service<ContinueExtensionSettings>()
                        val ghAuthToken = continueSettingsService.continueState.ghAuthToken;

                        if (ghAuthToken == null) {
                            // Open a dialog so user can enter their GitHub token
                            continuePluginService.sendToWebview("openOnboardingCard", null, uuid())
                            respond(null)
                        } else {
                            respond(ghAuthToken)
                        }
                    }

                    "setGitHubAuthToken" -> {
                        val continueSettingsService = service<ContinueExtensionSettings>()
                        val data = data as Map<String, String>
                        continueSettingsService.continueState.ghAuthToken = data["token"]
                        respond(null)
                    }

                    "openUrl" -> {
                        val url = data as String
                        java.awt.Desktop.getDesktop().browse(java.net.URI(url))
                        respond(null)
                    }

                    "pathSep" -> {
                        respond(File.separator)
                    }

                    else -> {}
                }
            } catch (error: Exception) {
                showToast("error", "Error handling message of type $messageType: $error")
            }
        }
    }

    fun configUpdate() {
        continuePluginService.coreMessenger?.request("config/reload", null, null) { _ -> }
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

    suspend fun getBranch(dir: String): String = withContext(Dispatchers.IO) {
        try {
            val builder = ProcessBuilder("git", "rev-parse", "--abbrev-ref", "HEAD")
            builder.directory(File(dir))
            val process = builder.start()

            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val output = reader.readLine()

            process.waitFor()

            output ?: "NONE"
        } catch (e: Exception) {
            "NONE"
        }
    }

    data class IndexTag(val directory: String, val branch: String, val artifactId: String)

    suspend fun getTags(artifactId: String): List<IndexTag> {
        val workspaceDirs = workspaceDirectories()

        // Collect branches concurrently using Kotlin coroutines
        val branches = withContext(Dispatchers.IO) {
            workspaceDirs.map { dir ->
                async { getBranch(dir) }
            }.map { it.await() }
        }

        // Create the list of IndexTag objects
        return workspaceDirs.mapIndexed { index, directory ->
            IndexTag(directory, branches[index], artifactId)
        }
    }

    fun readFile(filepath: String): String {
        try {
            val content = ApplicationManager.getApplication().runReadAction<String?> {
                val virtualFile = LocalFileSystem.getInstance().findFileByPath(filepath)
                if (virtualFile != null && FileDocumentManager.getInstance().isFileModified(virtualFile)) {
                    return@runReadAction FileDocumentManager.getInstance().getDocument(virtualFile)?.text
                }
                return@runReadAction null
            }

            if (content != null) {
                return content
            }

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
            val virtualFile =
                editor.let { FileDocumentManager.getInstance().getFile(it.document) } ?: return@runReadAction null

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

            return@runReadAction RangeInFileWithContents(
                virtualFile.path, Range(
                    Position(startLine, startChar),
                    Position(endLine, endChar)
                ), selectedText
            )
        }

        return result
    }

    fun sendHighlightedCode(edit: Boolean = false) {
        val rif = getHighlightedCode() ?: return

        continuePluginService.sendToWebview(
            "highlightedCode",
            mapOf(
                "rangeInFileWithContents" to rif,
                "edit" to edit
            )
        )
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
        "__pycache__",
        "site-packages",
        ".gradle",
        ".cache",
        "gems",
    )

    private fun shouldIgnoreDirectory(name: String): Boolean {
        val components = File(name).path.split(File.separator)
        return DEFAULT_IGNORE_DIRS.any { dir ->
            components.contains(dir)
        }
    }

    private fun workspaceDirectories(): Array<String> {
        val dirs = this.continuePluginService.workspacePaths
        if (dirs?.isNotEmpty() == true) {
            return dirs
        }

        if (this.workspacePath != null) {
            return arrayOf(this.workspacePath)
        }
        return arrayOf()
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

    @RequiresEdt
    private fun pinnedFiles(): List<String> {
        // Caused incompatibility issue with JetBrains new release
        return visibleFiles()
//        val fileEditorManager = FileEditorManager.getInstance(project) as? FileEditorManagerImpl ?: return listOf() // FileEditorManagerImpl should be the type, but this was marked as internal
//        val openFiles = fileEditorManager.openFiles.map { it.path }.toList()
//        val pinnedFiles = fileEditorManager.windows.flatMap { window -> window.files.filter { window.isFilePinned(it) } }.map { it.path }.toSet()
//        return openFiles.intersect(pinnedFiles).toList()
    }

    private fun currentFile(): String? {
        val fileEditorManager = FileEditorManager.getInstance(project)
        val editor = fileEditorManager.selectedTextEditor
        val virtualFile = editor?.document?.let { FileDocumentManager.getInstance().getFile(it) }
        return virtualFile?.path
    }

    suspend fun showToast(type: String, content: String, buttonTexts: Array<String> = emptyArray()): String? =
        withContext(Dispatchers.Default) {
            val notificationType = when (type.uppercase()) {
                "ERROR" -> NotificationType.ERROR
                "WARNING" -> NotificationType.WARNING
                else -> NotificationType.INFORMATION
            }

            val deferred = CompletableDeferred<String?>()
            val icon = IconLoader.getIcon("/icons/continue.svg", javaClass)

            val notification = NotificationGroupManager.getInstance().getNotificationGroup("Continue")
                .createNotification(content, notificationType).setIcon(icon)

            buttonTexts.forEach { buttonText ->
                notification.addAction(NotificationAction.create(buttonText) { _, _ ->
                    deferred.complete(buttonText)
                    notification.expire()
                })
            }

            // This timeout is to handle the case where a user closes out of the notification, which should trigger
            // the `whenExpired` event but that doesn't seem to be occurring.
            launch {
                delay(15000)
                if (!deferred.isCompleted) {
                    deferred.complete(null)
                    notification.expire()
                }
            }

            notification.whenExpired {
                if (!deferred.isCompleted) {
                    deferred.complete(null)
                }
            }

            notification.notify(project)

            deferred.await()
        }


    fun highlightCode(rangeInFile: RangeInFile, color: String?) {
        setFileOpen(rangeInFile.filepath, true)
    }

    private fun terminalContents(): String {
        return ""
    }

    private fun search(query: String): String {
        val command = GeneralCommandLine(ripgrep, "-i", "-C", "2", "--", query, ".")
        command.setWorkDirectory(project.basePath)
        return ExecUtil.execAndGetOutput(command).stdout ?: ""
    }
}