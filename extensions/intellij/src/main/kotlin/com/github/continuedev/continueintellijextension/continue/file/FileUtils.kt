package com.github.continuedev.continueintellijextension.`continue`.file

import com.github.continuedev.continueintellijextension.FileStats
import com.github.continuedev.continueintellijextension.FileType
import com.github.continuedev.continueintellijextension.`continue`.UriUtils
import com.intellij.openapi.application.runReadAction
import com.intellij.openapi.application.runWriteAction
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import kotlin.math.min


class FileUtils(
    private val project: Project,
) {
    fun fileExists(fileUri: String): Boolean =
        findFile(fileUri) != null

    fun writeFile(fileUri: String, content: String) {
        val path = toLocalPath(fileUri)
            ?: return
        val pathDirectory = VfsUtil.getParentDir(path)
            ?: return LOG.warn("Parent directory is null for $path")
        val vfsDirectory = VfsUtil.createDirectories(pathDirectory)
            ?: return LOG.warn("Could not create directories for $path")
        val pathFilename = VfsUtil.extractFileName(path)
            ?: return LOG.warn("Could not get filename for $path")
        runWriteAction {
            val newFile = vfsDirectory.createChildData(this, pathFilename)
            VfsUtil.saveText(newFile, content)
        }
    }

    fun removeFile(fileUri: String) {
        val found = findFile(fileUri)
            ?: return LOG.warn("File not found: $fileUri")
        runWriteAction {
            found.delete(this)
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
        val text = runReadAction {
            // note: document (if exists) is more up-to-date than VFS
            readDocument(found, maxLength) ?: VfsUtil.loadText(found, maxLength)
        }
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
        val path = toLocalPath(fileUri)
            ?: return null
        return VirtualFileManager.getInstance()
            .refreshAndFindFileByUrl(VfsUtilCore.pathToUrl(path))
    }

    /**
     * Resolves a file URI to a filesystem path, percent-decoding it so that
     * paths containing spaces (e.g. "C:/My Project") are not mistaken for
     * literal "%20" segments.
     */
    private fun toLocalPath(fileUri: String): String? =
        try {
            UriUtils.uriToPath(fileUri)
        } catch (e: Exception) {
            LOG.warn("Could not resolve path for $fileUri", e)
            null
        }

    private fun readDocument(file: VirtualFile, maxLength: Int): String? {
        val document = FileDocumentManager.getInstance().getDocument(file)
            ?: return null
        val length = min(document.textLength, maxLength)
        return document.getText(TextRange(0, length))
    }

    private fun normalizeLineEndings(text: String) =
        text.replace("\r\n", "\n")
            .replace("\r", "\n")

    private companion object {
        private val LOG = Logger.getInstance(FileUtils::class.java)
    }
}