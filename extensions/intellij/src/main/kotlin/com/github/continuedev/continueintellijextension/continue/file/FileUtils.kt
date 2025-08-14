package com.github.continuedev.continueintellijextension.`continue`.file

import com.github.continuedev.continueintellijextension.FileStats
import com.github.continuedev.continueintellijextension.FileType
import com.intellij.openapi.application.runWriteAction
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager


class FileUtils(
    private val project: Project,
) {
    fun fileExists(fileUri: String): Boolean =
        findFile(fileUri) != null

    fun writeFile(fileUri: String, content: String) {
        val path = VfsUtilCore.urlToPath(fileUri)
        val pathDirectory = VfsUtil.getParentDir(path)
            ?: return
        val vfsDirectory = VfsUtil.createDirectories(pathDirectory)
        val pathFilename = VfsUtil.extractFileName(path)
            ?: return
        runWriteAction {
            val newFile = vfsDirectory.createChildData(this, pathFilename)
            VfsUtil.saveText(newFile, content)
        }
    }

    fun listDir(fileUri: String): List<List<Any>> {
        val found = findFile(fileUri)
            ?: return emptyList()
        if (!found.isDirectory)
            return emptyList()
        return found.children.map { file ->
            val fileType = if (file.isDirectory)
                FileType.DIRECTORY.value
            else
                FileType.FILE.value
            listOf(file.name, fileType)
        }
    }

    fun readFile(fileUri: String, maxLength: Int = 100_000): String {
        val found = findFile(fileUri)
            ?: return ""
        val text = VfsUtil.loadText(found, maxLength)
        return normalizeLineEndings(text)
    }

    fun openFile(fileUri: String) {
        val found = findFile(fileUri)
            ?: return
        FileEditorManager.getInstance(project).openFile(found, true)
    }

    fun saveFile(fileUri: String) {
        val found = findFile(fileUri)
            ?: return
        val manager = FileDocumentManager.getInstance()
        val document = manager.getDocument(found)
            ?: return
        manager.saveDocument(document)
    }

    fun getFileStats(fileUris: List<String>): Map<String, FileStats> =
        fileUris.mapNotNull { fileUri ->
            val file = findFile(fileUri)
                ?: return@mapNotNull null
            fileUri to FileStats(file.timeStamp, file.length)
        }.toMap()

    private fun findFile(fileUri: String): VirtualFile? {
        val normalizedAuthority = normalizeWindowsAuthority(fileUri)
        return VirtualFileManager.getInstance()
            .refreshAndFindFileByUrl(normalizedAuthority)
    }

    private fun normalizeLineEndings(text: String) =
        text.replace("\r\n", "\n")
            .replace("\r", "\n")

    private fun normalizeWindowsAuthority(fileUri: String): String {
        val authorityPrefix = "file://"
        val noAuthorityPrefix = "file:///"
        if (fileUri.startsWith(authorityPrefix) && !fileUri.startsWith(noAuthorityPrefix)) {
            val path = fileUri.substringAfter(authorityPrefix)
            return "$noAuthorityPrefix$path"
        }
        return fileUri
    }
}