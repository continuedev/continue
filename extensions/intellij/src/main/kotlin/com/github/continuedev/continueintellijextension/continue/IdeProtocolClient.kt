package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.*
import com.github.continuedev.continueintellijextension.activities.ContinuePluginDisposable
import com.github.continuedev.continueintellijextension.activities.showTutorial
import com.github.continuedev.continueintellijextension.auth.ContinueAuthService
import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.github.continuedev.continueintellijextension.editor.EditorUtils
import com.github.continuedev.continueintellijextension.error.ContinueSentryService
import com.github.continuedev.continueintellijextension.protocol.*
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.services.GsonService
import com.github.continuedev.continueintellijextension.utils.getMachineUniqueID
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.SelectionModel
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.wm.ToolWindowManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection


class IdeProtocolClient(
    private val continuePluginService: ContinuePluginService,
    private val coroutineScope: CoroutineScope,
    private val project: Project,
    private val gsonService: GsonService = service<GsonService>(),
) : DumbAware {
    private val ide: IDE = IntelliJIDE(project, continuePluginService)
    private val diffStreamService = project.service<DiffStreamService>()


    /**
     * Create a dispatcher with limited parallelism to prevent UI freezing.
     * Note that there are 64 total threads available to the IDE.
     *
     * See this thread for details: https://github.com/continuedev/continue/issues/4098#issuecomment-2854865310
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    private val limitedDispatcher = Dispatchers.IO.limitedParallelism(4)

    fun handleMessage(msg: String, respond: (Any?) -> Unit) {
        coroutineScope.launch(limitedDispatcher) {
            val message = gsonService.gson.fromJson(msg, Message::class.java)
            val messageType = message.messageType
            val dataElement = message.data

            try {
                when (messageType) {
                    "toggleDevTools" -> {
                        project.getBrowser()?.openDevTools()
                    }

                    "showTutorial" -> {
                        showTutorial(project)
                    }

                    "jetbrains/isOSREnabled" -> {
                        respond(true)
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

                    "showFile" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ShowFilePayload::class.java
                        )
                        ide.openFile(params.filepath)
                        respond(null)
                    }

                    "getIdeSettings" -> {
                        val settings = ide.getIdeSettings()
                        respond(settings)
                    }

                    "getControlPlaneSessionInfo" -> {
                        val params = gsonService.gson.fromJson(
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
                        val params = gsonService.gson.fromJson(
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
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ShowDiffParams::class.java
                        )
                        ide.showDiff(params.filepath, params.newContents, params.stepIndex)
                        respond(null)
                    }

                    "readFile" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ReadFileParams::class.java
                        )
                        val contents = ide.readFile(params.filepath)
                        respond(contents)
                    }

                    "readRangeInFile" -> {
                        val params = gsonService.gson.fromJson(
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
                        val artifactId = gsonService.gson.fromJson(
                            dataElement.toString(),
                            getTagsParams::class.java
                        )
                        val tags = ide.getTags(artifactId)
                        respond(tags)
                    }

                    "getTerminalContents" -> {
                        val contents = ide.getTerminalContents()
                        respond(contents)
                    }

                    "isWorkspaceRemote" -> {
                        val isRemote = ide.isWorkspaceRemote()
                        respond(isRemote)
                    }

                    "saveFile" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            SaveFileParams::class.java
                        )
                        ide.saveFile(params.filepath)
                        respond(null)
                    }

                    "showVirtualFile" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ShowVirtualFileParams::class.java
                        )
                        ide.showVirtualFile(params.name, params.content)
                        respond(null)
                    }

                    "showLines" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ShowLinesParams::class.java
                        )
                        ide.showLines(params.filepath, params.startLine, params.endLine)
                        respond(null)
                    }

                    "getFileStats" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            GetFileStatsParams::class.java
                        )
                        val fileStatsMap = ide.getFileStats(params.files)
                        respond(fileStatsMap)
                    }

                    "listDir" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ListDirParams::class.java
                        )

                        val files = ide.listDir(params.dir)

                        respond(files)
                    }

                    "getGitRootPath" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            GetGitRootPathParams::class.java
                        )
                        val rootPath = ide.getGitRootPath(params.dir)
                        respond(rootPath)
                    }

                    "getBranch" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            GetBranchParams::class.java
                        )
                        val branch = ide.getBranch(params.dir)
                        respond(branch)
                    }

                    "getRepoName" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            GetRepoNameParams::class.java
                        )
                        val repoName = ide.getRepoName(params.dir)
                        respond(repoName)
                    }

                    "getDiff" -> {
                        val params = gsonService.gson.fromJson(
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
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            WriteFileParams::class.java
                        )
                        ide.writeFile(params.path, params.contents)
                        respond(null)
                    }

                    "fileExists" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            FileExistsParams::class.java
                        )
                        val exists = ide.fileExists(params.filepath)
                        respond(exists)
                    }

                    "openFile" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            OpenFileParams::class.java
                        )
                        ide.openFile(params.path)
                        respond(null)
                    }

                    "runCommand" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            RunCommandParams::class.java
                        )
                        ide.runCommand(params.command, params.options)
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

                    "closeSidebar" -> {
                        ApplicationManager.getApplication().invokeLater {
                            val toolWindowManager = ToolWindowManager.getInstance(project)
                            val toolWindow = toolWindowManager.getToolWindow("Continue")
                            toolWindow?.hide()
                        }
                    }

                    "getSearchResults" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            GetSearchResultsParams::class.java
                        )
                        val results = ide.getSearchResults(params.query, params.maxResults)
                        respond(results)
                    }

                    "getFileResults" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            GetFileResultsParams::class.java
                        )
                        val results = ide.getFileResults(params.pattern, params.maxResults)
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

                    "openUrl" -> {
                        val url = gsonService.gson.fromJson(
                            dataElement.toString(),
                            OpenUrlParam::class.java
                        )
                        ide.openUrl(url)
                        respond(null)
                    }

                    "insertAtCursor" -> {
                        val params = gsonService.gson.fromJson(
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

                    "acceptDiff" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            AcceptOrRejectDiffPayload::class.java
                        )
                        val filepath = params.filepath;

                        val editor = EditorUtils.getOrOpenEditor(project, filepath)?.editor

                        if (editor != null) {
                            diffStreamService.accept(editor)
                        }

                        respond(null)
                    }

                    "rejectDiff" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            AcceptOrRejectDiffPayload::class.java
                        )
                        val filepath = params.filepath;

                        val editor = EditorUtils.getOrOpenEditor(project, filepath)?.editor
                        if (editor != null) {
                            diffStreamService.reject(editor)
                        }
                        respond(null)

                    }

                    "applyToFile" -> {
                        val params = gsonService.gson.fromJson(
                            dataElement.toString(),
                            ApplyToFileParams::class.java
                        )

                        ApplyToFileHandler.apply(
                            project,
                            continuePluginService,
                            ide,
                            params
                        )
                        respond(null)
                    }

                    else -> {
                        println("Unknown message type: $messageType")
                    }
                }
            } catch (exception: Exception) {
                val exceptionMessage = "Error handling message of type $messageType: $exception"
                service<ContinueSentryService>().report(exception, exceptionMessage)
                ide.showToast(ToastType.ERROR, exceptionMessage)
            }
        }
    }

    fun sendAcceptRejectDiff(accepted: Boolean, stepIndex: Int) {
        project.getBrowser()?.sendToWebview("acceptRejectDiff", AcceptRejectDiff(accepted, stepIndex))
    }


    fun deleteAtIndex(index: Int) {
        project.getBrowser()?.sendToWebview("deleteAtIndex", DeleteAtIndex(index))
    }
}
