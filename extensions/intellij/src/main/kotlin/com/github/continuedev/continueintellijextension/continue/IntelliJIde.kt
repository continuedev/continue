package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.*
import com.github.continuedev.continueintellijextension.constants.ContinueConstants
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.`continue`.file.FileUtils
import com.github.continuedev.continueintellijextension.error.ContinueSentryService
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.*
import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.util.ExecUtil
import com.intellij.ide.BrowserUtil
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.EDT
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.impl.DocumentMarkupModel
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.guessProjectDir
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.psi.PsiDocumentManager
import com.intellij.testFramework.LightVirtualFile
import kotlinx.coroutines.*
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalToolWindowManager
import java.awt.Toolkit
import java.awt.datatransfer.DataFlavor
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

class IntelliJIDE(
    private val project: Project,
    private val continuePluginService: ContinuePluginService,

    ) : IDE {
    
    // Security-focused ignore patterns - should always be excluded for security reasons
    private val DEFAULT_SECURITY_IGNORE_FILETYPES = listOf(
        // Environment and configuration files with secrets
        "*.env", "*.env.*", ".env*", "config.json", "config.yaml", "config.yml",
        "settings.json", "appsettings.json", "appsettings.*.json",
        
        // Certificate and key files
        "*.key", "*.pem", "*.p12", "*.pfx", "*.crt", "*.cer", "*.jks",
        "*.keystore", "*.truststore",
        
        // Database files that may contain sensitive data
        "*.db", "*.sqlite", "*.sqlite3", "*.mdb", "*.accdb",
        
        // Credential and secret files
        "*.secret", "*.secrets", "credentials", "auth.json",
        "token", "*.token",
        
        // Backup files that might contain sensitive data
        "*.bak", "*.backup", "*.old", "*.orig",
        
        // Docker secrets
        "docker-compose.override.yml", "docker-compose.override.yaml",
        
        // SSH and GPG
        "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "*.ppk", "*.gpg"
    )
    
    private val DEFAULT_SECURITY_IGNORE_DIRS = listOf(
        // Environment and configuration directories
        ".env/", "env/",
        
        // Cloud provider credential directories
        ".aws/", ".gcp/", ".azure/", ".kube/", ".docker/",
        
        // Secret directories
        "secrets/", ".secrets/", "private/", ".private/", "certs/",
        "certificates/", "keys/", ".ssh/", ".gnupg/", ".gpg/",
        
        // Temporary directories that might contain sensitive data
        "tmp/secrets/", "temp/secrets/", ".tmp/"
    )
    
    // Additional non-security patterns for general indexing exclusion
    private val ADDITIONAL_SEARCH_IGNORE_FILETYPES = listOf(
        "*.DS_Store", "*-lock.json", "*.lock", "*.log", "*.ttf", "*.png",
        "*.jpg", "*.jpeg", "*.gif", "*.mp4", "*.svg", "*.ico", "*.pdf",
        "*.zip", "*.gz", "*.tar", "*.dmg", "*.tgz", "*.rar", "*.7z",
        "*.exe", "*.dll", "*.obj", "*.o", "*.o.d", "*.a", "*.lib",
        "*.so", "*.dylib", "*.ncb", "*.sdf", "*.woff", "*.woff2",
        "*.eot", "*.cur", "*.avi", "*.mpg", "*.mpeg", "*.mov", "*.mp3",
        "*.mkv", "*.webm", "*.jar", "*.onnx", "*.parquet", "*.pqt",
        "*.wav", "*.webp", "*.wasm", "*.plist", "*.profraw", "*.gcda",
        "*.gcno", "go.sum", "*.gitignore", "*.gitkeep", "*.continueignore",
        "*.csv", "*.uasset", "*.pdb", "*.bin", "*.pag", "*.swp", "*.jsonl"
    )
    
    private val ADDITIONAL_SEARCH_IGNORE_DIRS = listOf(
        ".git/", ".svn/", "node_modules/", "dist/", "build/", "Build/",
        "target/", "out/", "bin/", ".pytest_cache/", ".vscode-test/",
        "__pycache__/", "site-packages/", ".gradle/", ".mvn/", ".cache/",
        "gems/", "vendor/", ".venv/", "venv/", ".vscode/", ".idea/", ".vs/",
        ".continue/"
    )
    
    // Combined patterns for use in ripgrep
    private val DEFAULT_IGNORES = DEFAULT_SECURITY_IGNORE_FILETYPES + 
                                DEFAULT_SECURITY_IGNORE_DIRS + 
                                ADDITIONAL_SEARCH_IGNORE_FILETYPES + 
                                ADDITIONAL_SEARCH_IGNORE_DIRS

    private val gitService = GitService(project, continuePluginService)
    private val fileUtils = FileUtils(project)
    private val ripgrep: String = getRipgrepPath()

    init {
        try {
            val os = getOS()

            if (os == OS.LINUX || os == OS.MAC) {
                val file = File(ripgrep)
                if (!file.canExecute()) {
                    file.setExecutable(true)
                }
            }
        } catch (e: Throwable) {
            e.printStackTrace()
        }
    }

    override suspend fun getIdeInfo(): IdeInfo {
        val applicationInfo = ApplicationInfo.getInstance()
        val ideName: String = applicationInfo.fullApplicationName
        val ideVersion = applicationInfo.fullVersion
        val sshClient = System.getenv("SSH_CLIENT")
        val sshTty = System.getenv("SSH_TTY")

        var remoteName = "local"
        if (sshClient != null || sshTty != null) {
            remoteName = "ssh"
        }

        val pluginId = ContinueConstants.PLUGIN_ID
        val plugin = PluginManagerCore.getPlugin(PluginId.getId(pluginId))
        val extensionVersion = plugin?.version ?: "Unknown"

        return IdeInfo(
            ideType = "jetbrains",
            name = ideName,
            version = ideVersion,
            remoteName = remoteName,
            extensionVersion = extensionVersion,
            isPrerelease = false // TODO: Implement prerelease detection for JetBrains
        )
    }

    suspend fun enableHubContinueDev(): Boolean {
        return true
    }

    override suspend fun getIdeSettings(): IdeSettings {
        val settings = service<ContinueExtensionSettings>()


        return IdeSettings(
            remoteConfigServerUrl = settings.continueState.remoteConfigServerUrl,
            remoteConfigSyncPeriod = settings.continueState.remoteConfigSyncPeriod,
            userToken = settings.continueState.userToken ?: "",
            continueTestEnvironment = "production",
            pauseCodebaseIndexOnStart = false, // TODO: Needs to be implemented
        )
    }

    override suspend fun getDiff(includeUnstaged: Boolean): List<String> {
        return gitService.getDiff(includeUnstaged)
    }

    override suspend fun getClipboardContent(): Map<String, String> {
        val clipboard = Toolkit.getDefaultToolkit().systemClipboard
        val data = withContext(Dispatchers.IO) {
            clipboard.getData(DataFlavor.stringFlavor)
        }
        val text = data as? String ?: ""
        return mapOf("text" to text)
    }

    override suspend fun isWorkspaceRemote(): Boolean {
        return this.getIdeInfo().remoteName != "local"
    }

    override suspend fun getUniqueId(): String {
        return getMachineUniqueID()
    }

    override suspend fun getTerminalContents(): String {
        return withContext(Dispatchers.EDT) {
            try {
                val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Terminal")

                val terminalManager = TerminalToolWindowManager.getInstance(project)
                // Find the first terminal widget selected, whatever its state, running command or not.
                val widget = terminalManager.getWidgets().filterIsInstance<ShellTerminalWidget>().firstOrNull {
                    toolWindow?.contentManager?.getContent(it)?.isSelected ?: false
                }

                if (widget != null) {
                    val textBuffer = widget.terminalTextBuffer
                    val stringBuilder = StringBuilder()
                    // Iterate through all lines in the buffer (history + screen)
                    for (i in 0 until textBuffer.historyLinesCount + textBuffer.screenLinesCount) {
                        stringBuilder.append(textBuffer.getLine(i).text).append('\n')
                    }
                    stringBuilder.toString()
                } else {
                    "" // Return empty if no terminal is available
                }
            } catch (e: Exception) {
                println("Error getting terminal contents: ${e.message}")
                e.printStackTrace()
                "" // Return empty on error
            }
        }
    }

    override suspend fun getDebugLocals(threadIndex: Int): String {
        throw NotImplementedError("getDebugLocals not implemented yet")
    }

    override suspend fun getTopLevelCallStackSources(threadIndex: Int, stackDepth: Int): List<String> {
        throw NotImplementedError("getTopLevelCallStackSources not implemented")
    }

    override suspend fun getAvailableThreads(): List<Thread> {
        throw NotImplementedError("getAvailableThreads not implemented yet")
    }

    override suspend fun getWorkspaceDirs(): List<String> {
        return workspaceDirectories().toList()
    }

    override suspend fun fileExists(filepath: String): Boolean =
        fileUtils.fileExists(filepath)

    override suspend fun writeFile(path: String, contents: String) =
        withContext(Dispatchers.EDT) {
            fileUtils.writeFile(path, contents)
        }

    override suspend fun removeFile(path: String) =
        withContext(Dispatchers.EDT) {
            fileUtils.removeFile(path)
        }

    override suspend fun showVirtualFile(title: String, contents: String) {
        val virtualFile = LightVirtualFile(title, contents)
        ApplicationManager.getApplication().invokeLater {
            FileEditorManager.getInstance(project).openFile(virtualFile, true)
        }
    }

    override suspend fun getContinueDir(): String {
        return getContinueGlobalPath()
    }

    override suspend fun openFile(path: String) =
        withContext(Dispatchers.EDT) {
            fileUtils.openFile(path)
        }

    override suspend fun openUrl(url: String) {
        withContext(Dispatchers.IO) {
            BrowserUtil.browse(url)
        }
    }

    override suspend fun runCommand(command: String, options: TerminalOptions?) {
        val terminalOptions =
            options ?: TerminalOptions(reuseTerminal = true, terminalName = null, waitForCompletion = false)

        ApplicationManager.getApplication().invokeLater {
            try {
                val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Terminal")
                toolWindow?.activate({
                    try {
                        val terminalManager = TerminalToolWindowManager.getInstance(project)
                        var widget: ShellTerminalWidget? = null

                        // 1. Handle reuseTerminal option
                        if (terminalOptions.reuseTerminal == true && terminalManager.getWidgets().isNotEmpty()) {
                            // 2. Find by terminalName if provided
                            if (terminalOptions.terminalName != null) {
                                widget = terminalManager.getWidgets().filterIsInstance<ShellTerminalWidget>()
                                    .firstOrNull {
                                        toolWindow.contentManager.getContent(it).tabName == terminalOptions.terminalName
                                                && !it.hasRunningCommands()
                                    }
                            } else {
                                // 3. Find active terminal, or fall back to the first one
                                widget = terminalManager.getWidgets().filterIsInstance<ShellTerminalWidget>()
                                    .firstOrNull { toolWindow.contentManager.getContent(it).isSelected }
                                    ?: terminalManager.getWidgets().filterIsInstance<ShellTerminalWidget>().firstOrNull {
                                        !it.hasRunningCommands()
                                    }
                            }
                        }

                        // 4. Create a new terminal if needed
                        if (widget == null) {
                            widget = terminalManager.createLocalShellWidget(
                                project.basePath,
                                terminalOptions.terminalName,
                                true
                            )
                        } else {
                            // Ensure the found widget is visible
                            val content = toolWindow.contentManager.getContent(widget)
                            if (content != null) {
                                toolWindow.contentManager.setSelectedContent(content, true)
                            }
                        }

                        // 5. Show and send text
                        widget.ttyConnector?.write(command)

                    } catch (e: Exception) {
                        println("Error during terminal widget handling: ${e.message}")
                        e.printStackTrace()
                    }
                }, true)
            } catch (e: Exception) {
                println("Error activating terminal tool window: ${e.message}")
                e.printStackTrace()
            }
        }
    }

    override suspend fun saveFile(filepath: String) =
        withContext(Dispatchers.EDT) {
            fileUtils.saveFile(filepath)
        }

    override suspend fun readFile(filepath: String): String =
        fileUtils.readFile(filepath)

    override suspend fun readRangeInFile(filepath: String, range: Range): String {
        val fullContents = readFile(filepath)
        val lines = fullContents.lines()
        val startLine = range.start.line
        val startCharacter = range.start.character
        val endLine = range.end.line
        val endCharacter = range.end.character

        val firstLine = lines.getOrNull(startLine)?.substring(startCharacter) ?: ""
        val lastLine = lines.getOrNull(endLine)?.substring(0, endCharacter) ?: ""
        val betweenLines = if (endLine - startLine > 1) {
            lines.subList(startLine + 1, endLine).joinToString("\n")
        } else {
            ""
        }

        return listOf(firstLine, betweenLines, lastLine).filter { it.isNotEmpty() }.joinToString("\n")
    }

    override suspend fun showLines(filepath: String, startLine: Int, endLine: Int) {
        setFileOpen(filepath, true)
    }

    override suspend fun showDiff(filepath: String, newContents: String, stepIndex: Int) {
        continuePluginService.diffManager?.showDiff(filepath, newContents, stepIndex)
    }

    override suspend fun getOpenFiles(): List<String> =
        withContext(Dispatchers.EDT) {
            FileEditorManager.getInstance(project).openFiles
                .mapNotNull { it.toUriOrNull() }
                .toList()
        }

    override suspend fun getCurrentFile(): Map<String, Any>? =
        withContext(Dispatchers.EDT) {
            val fileEditorManager = FileEditorManager.getInstance(project)
            val document = fileEditorManager.selectedTextEditor?.document
            val virtualFile = document?.let { FileDocumentManager.getInstance().getFile(it) }
            virtualFile?.toUriOrNull()?.let {
                mapOf(
                    "path" to it,
                    "contents" to document.text,
                    "isUntitled" to false
                )
            }
        }

    override suspend fun getPinnedFiles(): List<String> {
        // Returning open files for now as per existing code
        return getOpenFiles()
    }

    override suspend fun getFileResults(pattern: String, maxResults: Int?): List<String> {
        val ideInfo = this.getIdeInfo()
        if (ideInfo.remoteName == "local") {
            try {
                // Create a single combined ignore pattern using glob brace expansion
                val defaultIgnorePattern = DEFAULT_IGNORES.joinToString(",") { it }
                
                var commandArgs = mutableListOf<String>(
                    ripgrep,
                    "--files",
                    "--iglob",
                    pattern,
                    "--ignore-file",
                    ".continueignore",
                    "--ignore-file",
                    ".gitignore",
                    "--glob",
                    "!{${defaultIgnorePattern}}" 
                )
                if (maxResults != null) {
                    commandArgs.add("--max-count")
                    commandArgs.add(maxResults.toString())
                }

                val command = GeneralCommandLine(commandArgs)

                command.setWorkDirectory(project.basePath)
                val results = ExecUtil.execAndGetOutput(command).stdout
                return results.split("\n")
            } catch (exception: Exception) {
                val message = "Error executing ripgrep: ${exception.message}"
                service<ContinueSentryService>().report(exception, message)
                showToast(ToastType.ERROR, message)
                return emptyList()
            }
        } else {
            throw NotImplementedError("Ripgrep not supported, this workspace is remote")
        }
    }

    override suspend fun getSearchResults(query: String, maxResults: Int?): String {
        val ideInfo = this.getIdeInfo()
        if (ideInfo.remoteName == "local") {
            try {
                // Create a single combined ignore pattern for ripgrep
                val defaultIgnorePattern = DEFAULT_IGNORES.joinToString(",") { it }
                
                val commandArgs = mutableListOf(
                    ripgrep,
                    "-i",
                    "--ignore-file",
                    ".continueignore",
                    "--ignore-file",
                    ".gitignore",
                    "-C",
                    "2",
                    "--heading",
                    "--glob",
                    "!{${defaultIgnorePattern}}" // Exclude all default ignores using brace expansion
                )

                // Conditionally add maxResults flag
                if (maxResults != null) {
                    commandArgs.add("-m")
                    commandArgs.add(maxResults.toString())
                }

                // Add the search query and path
                commandArgs.add("-e")
                commandArgs.add(query)
                commandArgs.add(".")

                val command = GeneralCommandLine(commandArgs)

                command.setWorkDirectory(project.basePath)
                return ExecUtil.execAndGetOutput(command).stdout
            } catch (exception: Exception) {
                val message = "Error executing ripgrep: ${exception.message}"
                service<ContinueSentryService>().report(exception, message)
                showToast(ToastType.ERROR, message)
                return "Error: Unable to execute ripgrep command."
            }
        } else {
            throw NotImplementedError("Ripgrep not supported, this workspace is remote")
        }
    }


    override suspend fun subprocess(command: String, cwd: String?): List<Any> {
        val commandList = command.split(" ")
        val builder = ProcessBuilder(commandList)

        if (cwd != null) {
            builder.directory(File(cwd))
        }

        val process = withContext(Dispatchers.IO) {
            builder.start()
        }

        val stdout = process.inputStream.bufferedReader().readText()
        val stderr = process.errorStream.bufferedReader().readText()

        withContext(Dispatchers.IO) {
            process.waitFor()
        }

        return listOf(stdout, stderr)
    }

    override suspend fun getProblems(filepath: String?): List<Problem> {
        val problems = mutableListOf<Problem>()

        ApplicationManager.getApplication().invokeAndWait {
            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@invokeAndWait

            val document = editor.document
            val psiFile = PsiDocumentManager.getInstance(project).getPsiFile(document) ?: return@invokeAndWait
            val highlightInfos = DocumentMarkupModel.forDocument(document, project, true)
                .allHighlighters
                .mapNotNull(HighlightInfo::fromRangeHighlighter)

            for (highlightInfo in highlightInfos) {
                if (highlightInfo.severity === HighlightSeverity.ERROR ||
                    highlightInfo.severity === HighlightSeverity.WARNING
                ) {
                    val startOffset = highlightInfo.startOffset
                    val endOffset = highlightInfo.endOffset

                    val startLineNumber = document.getLineNumber(startOffset)
                    val endLineNumber = document.getLineNumber(endOffset)
                    val startCharacter = startOffset - document.getLineStartOffset(startLineNumber)
                    val endCharacter = endOffset - document.getLineStartOffset(endLineNumber)

                    problems.add(
                        Problem(
                            filepath = psiFile.virtualFile?.toUriOrNull() ?: "",
                            range = Range(
                                start = Position(
                                    line = startLineNumber,
                                    character = startCharacter
                                ),
                                end = Position(
                                    line = endLineNumber,
                                    character = endCharacter
                                )
                            ),
                            message = highlightInfo.description
                        )
                    )
                }
            }
        }

        return problems
    }

    override suspend fun getBranch(dir: String): String {
        return withContext(Dispatchers.IO) {
            try {
                val builder = ProcessBuilder("git", "rev-parse", "--abbrev-ref", "HEAD")
                builder.directory(UriUtils.uriToFile(dir))
                val process = builder.start()
                val reader = BufferedReader(InputStreamReader(process.inputStream))
                val output = reader.readLine()
                process.waitFor()
                output ?: "NONE"
            } catch (e: Exception) {
                "NONE"
            }
        }
    }

    override suspend fun getTags(artifactId: String): List<IndexTag> {
        val workspaceDirs = this.getWorkspaceDirs()

        // Collect branches concurrently using Kotlin coroutines
        val branches = withContext(Dispatchers.IO) {
            workspaceDirs.map { dir ->
                async { getBranch(dir) }
            }.map { it.await() }
        }

        // Create the list of IndexTag objects
        return workspaceDirs.mapIndexed { index, directory ->
            IndexTag(artifactId, branches[index], directory)
        }
    }

    override suspend fun getRepoName(dir: String): String? {
        return withContext(Dispatchers.IO) {
            val directory = UriUtils.uriToFile(dir)
            val targetDir = if (directory.isFile) directory.parentFile else directory
            val builder = ProcessBuilder("git", "config", "--get", "remote.origin.url")
            builder.directory(targetDir)
            var output: String?

            try {
                val process = builder.start()
                val reader = BufferedReader(InputStreamReader(process.inputStream))
                output = reader.readLine()
                process.waitFor()
            } catch (e: Exception) {
                output = null
            }

            output
        }
    }

    override suspend fun showToast(type: ToastType, message: String, vararg otherParams: Any): Any {
        return withContext(Dispatchers.Default) {
            val notificationType = when (type) {
                ToastType.ERROR -> NotificationType.ERROR
                ToastType.WARNING -> NotificationType.WARNING
                else -> NotificationType.INFORMATION
            }

            val deferred = CompletableDeferred<String?>()

            val notification = NotificationGroupManager.getInstance().getNotificationGroup("Continue")
                .createNotification(message, notificationType).setIcon(Icons.Continue)

            val buttonTexts = otherParams.filterIsInstance<String>().toTypedArray()
            buttonTexts.forEach { buttonText ->
                notification.addAction(NotificationAction.create(buttonText) { _, _ ->
                    deferred.complete(buttonText)
                    notification.expire()
                })
            }

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

            deferred.await() ?: ""
        }
    }

    override suspend fun getGitRootPath(dir: String): String? {
        return withContext(Dispatchers.IO) {
            val builder = ProcessBuilder("git", "rev-parse", "--show-toplevel")
            builder.directory(UriUtils.uriToFile(dir))
            val process = builder.start()

            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val output = reader.readLine()
            process.waitFor()
            output
        }
    }

    override suspend fun listDir(dir: String): List<List<Any>> =
        fileUtils.listDir(dir)

    override suspend fun getFileStats(files: List<String>): Map<String, FileStats> =
        fileUtils.getFileStats(files)

    override suspend fun gotoDefinition(location: Location): List<RangeInFile> {
        throw NotImplementedError("gotoDefinition not implemented yet")
    }

    override suspend fun gotoTypeDefinition(location: Location): List<RangeInFile> {
        throw NotImplementedError("gotoTypeDefinition not implemented yet")
    }

    override suspend fun getSignatureHelp(location: Location): SignatureHelp? {
        throw NotImplementedError("getSignatureHelp not implemented yet")
    }

    override suspend fun getReferences(location: Location): List<RangeInFile> {
        throw NotImplementedError("getReferences not implemented yet")
    }

    override suspend fun getDocumentSymbols(textDocumentIdentifier: String): List<DocumentSymbol> {
        throw NotImplementedError("getDocumentSymbols not implemented yet")
    }

    override fun onDidChangeActiveTextEditor(callback: (filepath: String) -> Unit) {
        throw NotImplementedError("onDidChangeActiveTextEditor not implemented yet")
    }

    private fun setFileOpen(filepath: String, open: Boolean = true) {
        val file = LocalFileSystem.getInstance().findFileByPath(UriUtils.uriToFile(filepath).path)

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

    private fun workspaceDirectories(): Array<String> {
        val dirs = this.continuePluginService.workspacePaths

        if (dirs?.isNotEmpty() == true) {
            return dirs
        }

        return listOfNotNull(project.guessProjectDir()?.toUriOrNull()).toTypedArray()
    }

}
