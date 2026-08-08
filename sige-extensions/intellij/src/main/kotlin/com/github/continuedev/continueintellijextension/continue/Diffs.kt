package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.getAltKeyLabel
import com.intellij.diff.DiffContentFactory
import com.intellij.diff.DiffManager
import com.intellij.diff.DiffRequestPanel
import com.intellij.diff.contents.DiffContent
import com.intellij.diff.requests.SimpleDiffRequest
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.LocalFileSystem
import java.awt.Toolkit
import java.io.File
import java.nio.file.Paths
import javax.swing.Action
import javax.swing.JComponent


fun getDiffDirectory(): File {
    val homeDirectory = System.getProperty("user.home")
    val diffDirPath = Paths.get(homeDirectory).resolve(".continue").resolve(".diffs").toString()
    val diffDir = File(diffDirPath)
    if (!diffDir.exists()) {
        diffDir.mkdirs()
        diffDir.setWritable(true)
    }
    return diffDir
}

fun escapeFilepath(filepath: String): String {
    return filepath.replace("/", "_f_").replace("\\", "_b_").replace(":", "_c_")
}

interface DiffInfo {
    val originalFilepath: String
    val newFilepath: String
    var diffRequestPanel: DiffRequestPanel?
    val stepIndex: Int
    var dialog: DialogWrapper?
}

class DiffManager(private val project: Project) : DumbAware {

    // Mapping from file2 to relevant info
    private val diffInfoMap: MutableMap<String, DiffInfo> = mutableMapOf()
    private var lastFile2: String? = null

    fun showDiff(filepath: String, replacement: String, stepIndex: Int) {
        val diffDir = getDiffDirectory()
        val escapedPath = escapeFilepath(filepath)
        val file = diffDir.resolve(escapedPath)

        if (!file.exists()) {
            file.createNewFile()
        }
        file.writeText(replacement)
        openDiffWindow(UriUtils.parseUri(filepath).toString(), file.toURI().toString(), stepIndex)
    }

    private fun cleanUpFile(file2: String) {
        diffInfoMap[file2]?.dialog?.close(0)
        diffInfoMap.remove(file2)
        File(file2).delete()
        if (lastFile2 == file2) {
            lastFile2 = null
        }
    }


    fun acceptDiff(file2: String?) {
        val file = (file2 ?: lastFile2) ?: return
        val diffInfo = diffInfoMap[file] ?: return

        // Write contents to original file
        val virtualFile =
            LocalFileSystem.getInstance().findFileByPath(UriUtils.parseUri(diffInfo.originalFilepath).path) ?: return
        val document = FileDocumentManager.getInstance().getDocument(virtualFile) ?: return
        WriteCommandAction.runWriteCommandAction(project) {
            document.setText(File(file).readText())
        }
        FileDocumentManager.getInstance().saveDocument(document)

        // Notify server of acceptance
        project.service<ContinuePluginService>().ideProtocolClient?.sendAcceptRejectDiff(true, diffInfo.stepIndex)

        // Clean up state
        cleanUpFile(file)
    }

    fun rejectDiff(file2: String?) {
        val file = (file2 ?: lastFile2) ?: return
        val diffInfo = diffInfoMap[file] ?: return
        val continuePluginService = project.service<ContinuePluginService>()
        continuePluginService.ideProtocolClient?.deleteAtIndex(diffInfo.stepIndex)
        continuePluginService.ideProtocolClient?.sendAcceptRejectDiff(false, diffInfo.stepIndex)
        continuePluginService.coreMessenger?.request("cancelApply", null, null) {}
        cleanUpFile(file)
    }

    private fun openDiffWindow(
        file1: String,
        file2: String,
        stepIndex: Int
    ) {
        lastFile2 = file2

        // Create a DiffContent for each of the texts you want to compare
        val content1: DiffContent = DiffContentFactory.getInstance().create(UriUtils.uriToFile(file1).readText())
        val content2: DiffContent = DiffContentFactory.getInstance().create(UriUtils.uriToFile(file2).readText())

        // Create a SimpleDiffRequest and populate it with the DiffContents and titles
        val diffRequest = SimpleDiffRequest("Continue Diff", content1, content2, "Old", "New")

        // Get a DiffRequestPanel from the DiffManager and set the DiffRequest to it
        val diffInfo = diffInfoMap[file2]

        var shouldShowDialog = false
        if (diffInfo == null) {
            diffInfoMap[file2] = object : DiffInfo {
                override var dialog: DialogWrapper? = null
                override var diffRequestPanel: DiffRequestPanel? = null
                override val stepIndex: Int = stepIndex
                override val newFilepath: String = file2
                override val originalFilepath: String = file1
            }
            shouldShowDialog = true
        }

        ApplicationManager.getApplication().invokeLater {
            val diffPanel: DiffRequestPanel = diffInfo?.diffRequestPanel ?: DiffManager.getInstance()
                .createRequestPanel(project, Disposer.newDisposable(), null)
            diffPanel.setRequest(diffRequest)

            diffPanel.component.revalidate()
            diffPanel.component.repaint()

            if (shouldShowDialog) {
                // Create a dialog and add the DiffRequestPanel to it
                val dialog: DialogWrapper = diffInfo?.dialog
                    ?: object : DialogWrapper(project, true, IdeModalityType.MODELESS) {
                        init {
                            init()
                            title = "Continue Diff"
                        }

                        override fun createCenterPanel(): JComponent? {
                            return diffPanel.component
                        }

                        override fun doOKAction() {
                            super.doOKAction()
                            acceptDiff(file2)
                        }

                        override fun doCancelAction() {
                            super.doCancelAction()
                            rejectDiff(file2)
                        }

                        override fun createActions(): Array<Action> {
                            val okAction = okAction
                            okAction.putValue(Action.NAME, "Accept (${getAltKeyLabel()} ⇧ Y)")

                            val cancelAction = cancelAction
                            cancelAction.putValue(Action.NAME, "Reject (${getAltKeyLabel()} ⇧ N)")

                            return arrayOf(okAction, cancelAction)
                        }
                    }

                dialog.rootPane.isDoubleBuffered = true
                val screenSize = Toolkit.getDefaultToolkit().screenSize
                dialog.setSize(screenSize.width, screenSize.height)
                dialog.show()
                diffInfoMap[file2]?.dialog = dialog
                diffInfoMap[file2]?.diffRequestPanel = diffPanel
            }
        }
    }
}
