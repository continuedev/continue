package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.IdeType
import com.github.continuedev.continueintellijextension.Position
import com.github.continuedev.continueintellijextension.Problem
import com.github.continuedev.continueintellijextension.Range
import com.github.continuedev.continueintellijextension.activities.ContinuePluginDisposable
import com.github.continuedev.continueintellijextension.auth.AuthListener
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.constants.getConfigJsPath
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.editor.DiffStreamHandler
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.github.continuedev.continueintellijextension.protocol.*
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
import com.github.continuedev.continueintellijextension.utils.uuid
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.util.ExecUtil
import com.intellij.ide.plugins.PluginManager
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
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
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.*
import com.intellij.psi.PsiDocumentManager
import com.intellij.testFramework.LightVirtualFile
import com.intellij.util.concurrency.annotations.RequiresEdt
import kotlinx.coroutines.*
import java.awt.Desktop
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.io.*
import java.net.URI
import java.nio.charset.Charset
import java.nio.file.Paths
import java.util.*


class IdeProtocolClient(
    private val continuePluginService: ContinuePluginService,
    private val coroutineScope: CoroutineScope,
    private val workspacePath: String?,
    private val project: Project
) : DumbAware {
    val diffManager = DiffManager(project)
    private val ripgrep: String

    init {
        // Setup config.json / config.ts save listeners
        VirtualFileManager.getInstance().addAsyncFileListener(
            AsyncFileSaveListener(this), ContinuePluginDisposable.getInstance(project)
        )

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
                    "getIdeSettings" -> {
                        val settings =
                            ServiceManager.getService(ContinueExtensionSettings::class.java)

                        respond(
                            GetIdeSettingsReturnType(
                                remoteConfigServerUrl = settings.continueState.remoteConfigServerUrl,
                                remoteConfigSyncPeriod = settings.continueState.remoteConfigSyncPeriod,
                                userToken = settings.continueState.userToken ?: "",
                                enableControlServerBeta = settings.continueState.enableContinueTeamsBeta,
                                pauseCodebaseIndexOnStart = false, // TODO: Needs to be implemented
                                enableDebugLogs = false // TODO: Needs to be implemented
                            )
                        )
                    }

                    "getControlPlaneSessionInfo" -> {
                        val params = data as GetControlPlaneSessionInfoParams
                        val authService = service<ContinueAuthService>()

                        if (params.silent) {
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

                        // TODO: Verify that the right string for "jetbrains" is being used
                        respond(
                            GetIdeInfoReturnType(
                                IdeType.JETBRAINS,
                                ideName,
                                ideVersion,
                                remoteName,
                                extensionVersion
                            )
                        )
                    }

                    "getUniqueId" -> {
                        respond(getMachineUniqueID())
                    }

                    "copyText" -> {
                        val params = data as CopyTextParams
                        val clipboard = Toolkit.getDefaultToolkit().systemClipboard
                        val stringSelection = StringSelection(params.text)
                        clipboard.setContents(stringSelection, stringSelection)
                    }

                    "showDiff" -> {
                        val params = data as ShowDiffParams
                        diffManager.showDiff(
                            params.filepath,
                            params.newContents,
                            params.stepIndex
                        )
                        respond(null)
                    }

                    "readFile" -> {
                        val params = data as ReadFileParams
                        val msg = readFile(params.filepath)
                        respond(msg)
                    }

                    "isTelemetryEnabled" -> {
                        respond(true)
                    }

                    "readRangeInFile" -> {
                        val params = data as ReadRangeInFileParams
                        val fullContents = readFile(params.filepath)
                        val startLine = params.range.start.line
                        val startCharacter = params.range.start.character
                        val endLine = params.range.end.line
                        val endCharacter = params.range.end.character

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
                        val artifactId = data as GetTagsParams
                        val tags = getTags(artifactId)
                        respond(tags)
                    }

                    // TODO: Use `GetWorkSpaceConfigsParams` and `GetWorkSpaceConfigsReturnType`
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

                    "saveFile" -> {
                        val params = data as SaveFileParams
                        saveFile(params.filepath)
                        respond(null)
                    }

                    "showVirtualFile" -> {
                        val params = data as ShowVirtualFileParams
                        showVirtualFile(
                            params.name, params.content
                        )
                        respond(null)
                    }

                    // TODO: This is just opening the file, now showing specific lines
                    "showLines" -> {
                        val params = data as ShowLinesParams
                        setFileOpen(params.filepath, true)
                        respond(null)
                    }

                    "getLastModified" -> {
                        val params = data as GetLastModifiedParams
                        val pathToLastModified = params.files.associateWith { file ->
                            File(file).lastModified()
                        } as GetLastModifiedReturnType

                        respond(pathToLastModified)
                    }

                    "listDir" -> {
                        val params = data as ListDirParams
                        val files: List<List<Any>> = File(params.dir).listFiles()?.map {
                            listOf(it.name, if (it.isDirectory) 2 else 1)
                        } ?: emptyList()
                        respond(files)
                    }

                    "getGitRootPath" -> {
                        val params = data as GetGitRootPathParams
                        val builder = ProcessBuilder("git", "rev-parse", "--show-toplevel")
                        builder.directory(File(params.dir))
                        val process = builder.start()

                        val reader = BufferedReader(InputStreamReader(process.inputStream))
                        val output = reader.readLine()
                        process.waitFor()

                        respond(output)
                    }

                    "getBranch" -> {
                        val params = data as GetBranchParams
                        val branch = getBranch(params.dir)
                        respond(branch)
                    }

                    "getRepoName" -> {
                        val params = data as GetRepoNameParams
                        val directory = File(params.dir)
                        val targetDir = if (directory.isFile) directory.parentFile else directory
                        val builder = ProcessBuilder("git", "config", "--get", "remote.origin.url")
                        builder.directory(targetDir)
                        var output = "NONE"
                        try {
                            val process = builder.start()

                            val reader = BufferedReader(InputStreamReader(process.inputStream))
                            output = reader.readLine()
                            process.waitFor()
                        } catch (error: Exception) {
                            println("Git not found: $error")
                        }

                        respond(output)
                    }

                    // TODO: Implement `includeUnstaged` param
                    "getDiff" -> {
                        val workspaceDirs = workspaceDirectories()
                        val diffs = mutableListOf<String>()

                        for (workspaceDir in workspaceDirs) {
                            val output = StringBuilder()
                            val builder = ProcessBuilder("git", "diff")
                            builder.directory(File(workspaceDir))
                            val process = builder.start()

                            val reader = BufferedReader(InputStreamReader(process.inputStream))
                            var line: String? = reader.readLine()
                            while (line != null) {
                                output.append(line)
                                output.append("\n")
                                line = reader.readLine()
                            }

                            process.waitFor()
                            diffs.add(output.toString())
                        }

                        respond(diffs as GetDiffReturnType)
                    }

                    "getProblems" -> {
                        // Get currently active editor
                        var editor: Editor? = null

                        ApplicationManager.getApplication().invokeAndWait {
                            editor = FileEditorManager.getInstance(project).selectedTextEditor
                        }

                        if (editor == null) {
                            respond(emptyList<Problem>())
                            return@launch
                        }

                        val project = editor!!.project ?: return@launch

                        ApplicationManager.getApplication().invokeLater {
                            val document = editor!!.document
                            val psiFile =
                                PsiDocumentManager.getInstance(project).getPsiFile(document) ?: return@invokeLater
                            val problems = ArrayList<Problem>()
                            val highlightInfos = DocumentMarkupModel.forDocument(document, project, true)
                                .allHighlighters
                                .mapNotNull(HighlightInfo::fromRangeHighlighter)

                            for (highlightInfo in highlightInfos) {
                                if (highlightInfo.severity === HighlightSeverity.ERROR ||
                                    highlightInfo.severity === HighlightSeverity.WARNING
                                ) {
                                    val startOffset = highlightInfo.startOffset
                                    val endOffset = highlightInfo.endOffset

                                    problems.add(
                                        Problem(
                                            filepath = psiFile.virtualFile?.path ?: "",
                                            range = Range(
                                                start = Position(
                                                    line = document.getLineNumber(startOffset),
                                                    character = startOffset - document.getLineStartOffset(
                                                        document.getLineNumber(startOffset)
                                                    )
                                                ),
                                                end = Position(
                                                    line = document.getLineNumber(endOffset),
                                                    character = endOffset - document.getLineStartOffset(
                                                        document.getLineNumber(endOffset)
                                                    )
                                                )
                                            ),
                                            message = highlightInfo.description
                                        )
                                    )
                                }
                            }
                            respond(problems)
                        }
                    }

                    "getConfigJsUrl" -> {
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

                    // Running commands not yet supported in JetBrains
                    "runCommand" -> {
                        respond(null)
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
                        val folders = mutableListOf<String>()
                        fun findNestedFolders(dirPath: String) {
                            val dir = File(dirPath)
                            val nestedFolders =
                                dir.listFiles { file -> file.isDirectory }?.map { file -> file.absolutePath }
                                    ?: emptyList()
                            folders.addAll(nestedFolders);
                            nestedFolders.forEach { folder -> findNestedFolders(folder) }
                        }
                        findNestedFolders(workspacePath)
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

                    ToIdeFromWebviewProtocolMessageTypes.INSERT_AT_CURSOR -> {
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
                        val msg = data as Map<String, String>;
                        val text = msg["text"] as String
                        val curSelectedModelTitle = msg["curSelectedModelTitle"] as String

                        val editor = FileEditorManager.getInstance(project).selectedTextEditor

                        if (editor == null) {
                            showToast("error", "No active editor to apply edits to")
                            respond(null)
                            return@launch
                        }

                        if (editor.document.text.trim().isEmpty()) {
                            WriteCommandAction.runWriteCommandAction(project) {
                                editor.document.insertString(0, text)
                            }
                            respond(null)
                            return@launch
                        }

                        val config = readConfigJson()
                        var llm = getModelByRole(config, "applyCodeBlock")

                        if (llm == null) {
                            val models = (config as? Map<*, *>)?.get("models") as? List<Map<*, *>>
                            llm = models?.find { model -> model["title"] == curSelectedModelTitle } as Map<String, Any>

                            if (llm == null) {
                                showToast("error", "Model '$curSelectedModelTitle' not found in config.")
                                respond(null)
                                return@launch
                            }
                        }

                        val llmTitle = (llm as? Map<*, *>)?.get("title") as? String ?: ""

                        val prompt =
                            "The following code was suggested as an edit:\n```\n${text}\n```\nPlease apply it to the previous code."

                        val rif = getHighlightedCode()

                        val (prefix, highlighted, suffix) = if (rif == null) {
                            // If no highlight, use the whole document as highlighted
                            Triple("", editor.document.text, "")
                        } else {
                            val prefix = editor.document.getText(TextRange(0, rif.range.start.character))
                            val highlighted = rif.contents
                            val suffix =
                                editor.document.getText(TextRange(rif.range.end.character, editor.document.textLength))

                            // Remove the selection after processing
                            ApplicationManager.getApplication().invokeLater {
                                editor.selectionModel.removeSelection()
                            }

                            Triple(prefix, highlighted, suffix)
                        }

                        val diffStreamHandler =
                            DiffStreamHandler(
                                project,
                                editor,
                                rif?.range?.start?.line ?: 0,
                                rif?.range?.end?.line ?: (editor.document.lineCount - 1),
                                {}, {})

                        val diffStreamService = project.service<DiffStreamService>()
                        diffStreamService.register(diffStreamHandler, editor)

                        diffStreamHandler.streamDiffLinesToEditor(
                            prompt, prefix, highlighted, suffix, llmTitle
                        )

                        respond(null)
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
                        Desktop.getDesktop().browse(URI(url))
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

    private suspend fun getBranch(dir: String): String = withContext(Dispatchers.IO) {
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

    private suspend fun getTags(artifactId: String): List<IndexTag> {
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

    private fun readFile(filepath: String): String {
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

    private fun currentFile(): Map<String, Any?>? {
        val fileEditorManager = FileEditorManager.getInstance(project)
        val editor = fileEditorManager.selectedTextEditor
        val virtualFile = editor?.document?.let { FileDocumentManager.getInstance().getFile(it) }
        return virtualFile?.let {
            mapOf(
                "path" to it.path,
                "contents" to editor.document.text,
                "isUntitled" to false
            )
        }
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


    private fun terminalContents(): String {
        return ""
    }

    private fun search(query: String): String {
        val command = GeneralCommandLine(ripgrep, "-i", "-C", "2", "--", query, ".")
        command.setWorkDirectory(project.basePath)
        return ExecUtil.execAndGetOutput(command).stdout ?: ""
    }

    private fun getModelByRole(
        config: Any,
        role: Any
    ): Any? {
        val experimental = (config as? Map<*, *>)?.get("experimental") as? Map<*, *>
        val roleTitle = (experimental?.get("modelRoles") as? Map<*, *>)?.get(role) as? String ?: return null

        val models = (config as? Map<*, *>)?.get("models") as? List<*>
        val matchingModel = models?.find { model ->
            (model as? Map<*, *>)?.get("title") == roleTitle
        }

        return matchingModel
    }
}
