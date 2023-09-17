package com.github.continuedev.continueintellijextension.`continue`

import com.intellij.diff.DiffContentFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.io.File


val FILENAME = "/Users/natesesti/.continue/diffs/diff"

class DiffManager(private val project: Project) {

    private val diffContentFactory = DiffContentFactory.getInstance()

    fun showDiff(filepath: String, replacement: String, step_index: Int) {
        val file = File(FILENAME)

        if (!file.exists()) {
            file.parentFile.mkdirs()
            file.createNewFile()
        }
        file.writeText(replacement)
        openDiffWindow(filepath, FILENAME, "Old", "New")
    }

    fun openDiffWindow(
        file1: String,
        file2: String,
        title1: String,
        title2: String
    ) {
        val diffContentFactory = DiffContentFactory.getInstance()

        val virtualFile1 = LocalFileSystem.getInstance().findFileByPath(file1)
        val virtualFile2 = LocalFileSystem.getInstance().findFileByPath(file2)


//        val editorFactory: EditorFactory = EditorFactory.getInstance()
//        val editor1: Editor = editorFactory.createEditor(document1)
//        val editor2: Editor = editorFactory.createEditor(document2)
//
//        val diffPanel: DiffPanel = com.github.continuedev.continueintellijextension.DiffManager.getInstance().createDiffPanel(
//                WindowWrapper.Mode.FRAME,
//                project,
//                DiffTool.SCROLL_FROM_CENTER,
//                MyDiffRequestProcessor(project, editor1, editor2)
//        )

//        if (virtualFile1 != null && virtualFile2 != null) {
//            val contentDiff1 = diffContentFactory.create(project, virtualFile1)
//            val contentDiff2 = diffContentFactory.create(project, virtualFile2)
//
//            val diffRequest = SimpleDiffRequest("Diff Window Title", contentDiff1, contentDiff2, title1, title2)
//
//            ApplicationManager.getApplication().invokeLater {
//                DiffManager.getInstance().showDiff(project, diffRequest)
//            }
//        } else {
//            // Handle the case where the files are not found
//        }
    }
}
