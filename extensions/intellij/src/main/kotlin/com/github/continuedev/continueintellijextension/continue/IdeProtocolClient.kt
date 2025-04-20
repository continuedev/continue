package com.github.continuedev.continueintellijextension.`continue`

import IntelliJIDE
import com.github.continuedev.continueintellijextension.*
import com.github.continuedev.continueintellijextension.activities.ContinuePluginDisposable
import com.github.continuedev.continueintellijextension.activities.showTutorial
import com.github.continuedev.continueintellijextension.auth.AuthListener
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.editor.DiffStreamHandler
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.github.continuedev.continueintellijextension.protocol.*
import com.github.continuedev.continueintellijextension.services.*
import com.github.continuedev.continueintellijextension.utils.*
import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.VirtualFileManager
import kotlinx.coroutines.*
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.lang.IllegalStateException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException


class IdeProtocolClient(
    private val continuePluginService: ContinuePluginService,
    private val coroutineScope: CoroutineScope,
    private val project: Project
) : DumbAware {
    private val ide: IDE = IntelliJIDE(project, continuePluginService)

    init {
        // Setup config.json / config.ts save listeners
        VirtualFileManager.getInstance().addAsyncFileListener(
            AsyncFileSaveListener(continuePluginService), ContinuePluginDisposable.getInstance(project)
        )
    }

    fun updateLastFileSaveTimestamp() {
        (ide as IntelliJIDE).updateLastFileSaveTimestamp()
    }

    fun handleMessage(msg: String, respond: (Any?) -> Unit) {
        coroutineScope.launch(Dispatchers.IO) {
            val message = Gson().fromJson(msg, Message::class.java)
            val messageType = message.messageType
            val dataElement = message.data

            try {
                when (messageType) {
                    "toggleDevTools" -> {
                        continuePluginService.continuePluginWindow?.browser?.browser?.openDevtools()
                    }

                    "showTutorial" -> {
                        showTutorial(project)
                    }

                    "jetbrains/isOSREnabled" -> {
                        val isOSREnabled =
                            ServiceManager.getService(ContinueExtensionSettings::class.java).continueState.enableOSR
                        respond(isOSREnabled)
                    }

                    "jetbrains/getColors" -> {
                        val colors = GetTheme().getTheme();
                        respond(colors)
                    }

                    "jetbrains/onLoad" -> {
                        val jsonData = mutableMapOf(
                            "windowId" to continuePluginService.windowId,
                            "workspacePaths" to continuePluginService.workspacePaths,
                            "vscMachineId" to getMachineUniqueID(),
                            "vscMediaUrl" to "http://continue",
                        )
                        respond(jsonData)
                    }

                    "getIdeSettings" -> {
                        val settings = ide.getIdeSettings()
                        respond(settings)
                    }

                    "getControlPlaneSessionInfo" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetControlPlaneSessionInfoParams::class.java
                        )
                        val authService = service<ContinueAuthService>()

                        if (params.silent) {
                            val sessionInfo = authService.loadControlPlaneSessionInfo()
                            respond(sessionInfo)
                        } else {
                            authService.startAuthFlow(project, params.useOnboarding)
                            respond(null)
                        }
                    }

                    "logoutOfControlPlane" -> {
                        val authService = service<ContinueAuthService>()
                        authService.signOut()

                        respond(null)
                    }

                    "getIdeInfo" -> {
                        val ideInfo = ide.getIdeInfo()
                        respond(ideInfo)
                    }

                    "getUniqueId" -> {
                        val uniqueId = ide.getUniqueId()
                        respond(uniqueId)
                    }

                    "copyText" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            CopyTextParams::class.java
                        )
                        val textToCopy = params.text
                        val clipboard = Toolkit.getDefaultToolkit().systemClipboard
                        val stringSelection = StringSelection(textToCopy)
                        clipboard.setContents(stringSelection, stringSelection)
                        respond(null)
                    }

                    "showDiff" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ShowDiffParams::class.java
                        )
                        ide.showDiff(params.filepath, params.newContents, params.stepIndex)
                        respond(null)
                    }

                    "readFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ReadFileParams::class.java
                        )
                        val contents = ide.readFile(params.filepath)
                        respond(contents)
                    }

                    "isTelemetryEnabled" -> {
                        val isEnabled = ide.isTelemetryEnabled()
                        respond(isEnabled)
                    }

                    "readRangeInFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ReadRangeInFileParams::class.java
                        )
                        val contents = ide.readRangeInFile(params.filepath, params.range)
                        respond(contents)
                    }

                    "getWorkspaceDirs" -> {
                        val dirs = ide.getWorkspaceDirs()
                        respond(dirs)
                    }

                    "getTags" -> {
                        val artifactId = Gson().fromJson(
                            dataElement.toString(),
                            getTagsParams::class.java
                        )
                        val tags = ide.getTags(artifactId)
                        respond(tags)
                    }

                    "getWorkspaceConfigs" -> {
                        val configs = ide.getWorkspaceConfigs()
                        respond(configs)
                    }

                    "getTerminalContents" -> {
                        val contents = ide.getTerminalContents()
                        respond(contents)
                    }

                    "saveFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            SaveFileParams::class.java
                        )
                        ide.saveFile(params.filepath)
                        respond(null)
                    }

                    "showVirtualFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ShowVirtualFileParams::class.java
                        )
                        ide.showVirtualFile(params.name, params.content)
                        respond(null)
                    }

                    "showLines" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ShowLinesParams::class.java
                        )
                        ide.showLines(params.filepath, params.startLine, params.endLine)
                        respond(null)
                    }

                    "getFileStats" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetFileStatsParams::class.java
                        )
                        val fileStatsMap = ide.getFileStats(params.files)
                        respond(fileStatsMap)
                    }

                    "listDir" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ListDirParams::class.java
                        )

                        val files = ide.listDir(params.dir)

                        respond(files)
                    }

                    "getGitRootPath" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetGitRootPathParams::class.java
                        )
                        val rootPath = ide.getGitRootPath(params.dir)
                        respond(rootPath)
                    }

                    "getBranch" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetBranchParams::class.java
                        )
                        val branch = ide.getBranch(params.dir)
                        respond(branch)
                    }

                    "getRepoName" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetRepoNameParams::class.java
                        )
                        val repoName = ide.getRepoName(params.dir)
                        respond(repoName)
                    }

                    "getDiff" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetDiffParams::class.java
                        )
                        val diffs = ide.getDiff(params.includeUnstaged)
                        respond(diffs)
                    }

                    "getProblems" -> {
                        val problems = ide.getProblems()
                        respond(problems)
                    }

                    "writeFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            WriteFileParams::class.java
                        )
                        ide.writeFile(params.path, params.contents)
                        respond(null)
                    }

                    "fileExists" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            FileExistsParams::class.java
                        )
                        val exists = ide.fileExists(params.filepath)
                        respond(exists)
                    }

                    "openFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            OpenFileParams::class.java
                        )
                        ide.openFile(params.path)
                        respond(null)
                    }

                    "runCommand" -> {
                        // Running commands not yet supported in JetBrains
                        respond(null)
                    }

                    "showToast" -> {
                        val jsonArray = dataElement.asJsonArray

                        // Get toast type from first element, default to INFO if invalid
                        val typeStr = if (jsonArray.size() > 0) jsonArray[0].asString else ToastType.INFO.value
                        val type = ToastType.values().find { it.value == typeStr } ?: ToastType.INFO

                        // Get message from second element
                        val message = if (jsonArray.size() > 1) jsonArray[1].asString else ""

                        // Get remaining elements as otherParams
                        val otherParams = if (jsonArray.size() > 2) {
                            jsonArray.drop(2).map { it.asString }.toTypedArray()
                        } else {
                            emptyArray()
                        }

                        val result = ide.showToast(type, message, *otherParams)
                        respond(result)
                    }

                    "getSearchResults" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetSearchResultsParams::class.java
                        )
                        val results = ide.getSearchResults(params.query)
                        respond(results)
                    }

                    "getFileResults" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetFileResultsParams::class.java
                        )
                        val results = ide.getFileResults(params.pattern)
                        respond(results)
                    }

                    "getOpenFiles" -> {
                        val openFiles = ide.getOpenFiles()
                        respond(openFiles)
                    }

                    "getCurrentFile" -> {
                        val currentFile = ide.getCurrentFile()
                        respond(currentFile)
                    }

                    "getPinnedFiles" -> {
                        val pinnedFiles = ide.getPinnedFiles()
                        respond(pinnedFiles)
                    }

                    "getGitHubAuthToken" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            GetGhTokenArgs::class.java
                        )

                        val ghAuthToken = ide.getGitHubAuthToken(params)

                        if (ghAuthToken == null) {
                            // Open a dialog so user can enter their GitHub token
                            continuePluginService.sendToWebview("openOnboardingCard", null, uuid())
                            respond(null)
                        } else {
                            respond(ghAuthToken)
                        }
                    }

                    "setGitHubAuthToken" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            SetGitHubAuthTokenParams::class.java
                        )
                        val continueSettingsService = service<ContinueExtensionSettings>()
                        continueSettingsService.continueState.ghAuthToken = params.token
                        respond(null)
                    }

                    "openUrl" -> {
                        val url = Gson().fromJson(
                            dataElement.toString(),
                            OpenUrlParam::class.java
                        )
                        ide.openUrl(url)
                        respond(null)
                    }

                    "insertAtCursor" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            InsertAtCursorParams::class.java
                        )

                        ApplicationManager.getApplication().invokeLater {
                            val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@invokeLater
                            val selectionModel: SelectionModel = editor.selectionModel

                            val document = editor.document
                            val startOffset = selectionModel.selectionStart
                            val endOffset = selectionModel.selectionEnd

                            WriteCommandAction.runWriteCommandAction(project) {
                                document.replaceString(startOffset, endOffset, params.text)
                            }
                        }
                    }

                    "applyToFile" -> {
                        val params = Gson().fromJson(
                            dataElement.toString(),
                            ApplyToFileParams::class.java
                        )
                        val filepath = params.filepath

                        continuePluginService.sendToWebview("updateApplyState", mapOf(
                            "streamId" to params.streamId,
                            "status" to "streaming",
                            "fileContent" to params.text,
                            "toolCallId" to params.toolCallId,
                            "filepath" to filepath
                        ))


                        fun closeStream () {
                            continuePluginService.sendToWebview("updateApplyState", mapOf(
                                "numDiffs" to 0,
                                "streamId" to params.streamId,
                                "status" to "closed",
                                "fileContent" to params.text,
                                "toolCallId" to params.toolCallId,
                                "filepath" to filepath
                            ))
                        }

                        var editor: Editor? = null;

                        if (!filepath.isNullOrEmpty()) {
                            val virtualFile = VirtualFileManager.getInstance().findFileByUrl(filepath)
                            if (virtualFile != null) {
                                ApplicationManager.getApplication().invokeAndWait {
                                    FileEditorManager.getInstance(project).openFile(virtualFile, true)?.first()
                                }
                            }
                        }
                        editor = FileEditorManager.getInstance(project).selectedTextEditor

                        if (editor == null) {
                            ide.showToast(ToastType.ERROR, "No active editor to apply edits to")
                            closeStream()
                            respond(null)
                            return@launch
                        }

                        if (editor.document.text.trim().isEmpty()) {
                            WriteCommandAction.runWriteCommandAction(project) {
                                editor.document.insertString(0, params.text)
                            }
                            closeStream()
                            respond(null)
                            return@launch
                        }

                        val llm: Any = try {
                            suspendCancellableCoroutine { continuation ->
                                continuePluginService.coreMessenger?.request(
                                    "config/getSerializedProfileInfo",
                                    null,
                                    null
                                ) { response ->
                                    try {
                                        val responseObject = response as Map<*, *>
                                        val responseContent = responseObject["content"] as Map<*, *>
                                        val result = responseContent["result"] as Map<*, *>
                                        val config = result["config"] as Map<*, *>

                                        val selectedModels = config["selectedModelByRole"] as? Map<*, *>
                                        var applyCodeBlockModel = selectedModels?.get("apply") as? Map<*, *>
                                        
                                        // If "apply" role model is not found, try "chat" role
                                        if (applyCodeBlockModel == null) {
                                            applyCodeBlockModel = selectedModels?.get("chat") as? Map<*, *>
                                        }

                                        if (applyCodeBlockModel != null) {
                                            continuation.resume(applyCodeBlockModel)
                                        } else {
                                            // If neither "apply" nor "chat" models are available, return with exception
                                            continuation.resumeWithException(IllegalStateException("No 'apply' or 'chat' model found in configuration."))
                                        }
                                    } catch (e: Exception) {
                                        continuation.resumeWithException(e)
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            launch {
                                ide.showToast(
                                    ToastType.ERROR, "Failed to fetch model configuration"
                                )
                            }
                            closeStream()
                            respond(null)
                            return@launch
                        }

                        val diffStreamService = project.service<DiffStreamService>()
                        // Clear all diff blocks before running the diff stream
                        diffStreamService.reject(editor)

                        val llmTitle = (llm as? Map<*, *>)?.get("title") as? String ?: ""

                        val prompt =
                            "The following code was suggested as an edit:\n```\n${params.text}\n```\nPlease apply it to the previous code."

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
                                {}, 
                                {}, 
                                params.streamId,
                                params.toolCallId
                            )

                        diffStreamService.register(diffStreamHandler, editor)

                        diffStreamHandler.streamDiffLinesToEditor(
                            prompt, prefix, highlighted, suffix, llmTitle
                        )

                        respond(null)
                    }

                    else -> {
                        println("Unknown message type: $messageType")
                    }
                }
            } catch (error: Exception) {
                ide.showToast(ToastType.ERROR, " Error handling message of type $messageType: $error")
            }
        }
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

            return@runReadAction virtualFile.toUriOrNull()?.let {
                RangeInFileWithContents(
                    it, Range(
                        Position(startLine, startChar),
                        Position(endLine, endChar)
                    ), selectedText
                )
            }
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
        continuePluginService.sendToWebview("acceptRejectDiff", AcceptRejectDiff(accepted, stepIndex), uuid())
    }

    fun deleteAtIndex(index: Int) {
        continuePluginService.sendToWebview("deleteAtIndex", DeleteAtIndex(index), uuid())
    }
}