package com.github.continuedev.continueintellijextension.`continue`.file

import com.github.continuedev.continueintellijextension.FileType
import com.github.continuedev.continueintellijextension.`continue`.UriUtils
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.vfs.LocalFileSystem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.FileInputStream
import java.nio.charset.Charset

class FileUtils {
    // todo: use VFS (it's moved from IntellijIde)

    fun fileExists(uri: String): Boolean {
        val file = UriUtils.uriToFile(uri)
        return file.exists()
    }

    fun writeFile(uri: String, contents: String) {
        val file = UriUtils.uriToFile(uri)
        file.parentFile?.mkdirs()
        file.writeText(contents)
    }

    fun listDir(dir: String): List<List<Any>> {
        val files = UriUtils.uriToFile(dir).listFiles()?.map {
            listOf(it.name, if (it.isDirectory) FileType.DIRECTORY.value else FileType.FILE.value)
        } ?: emptyList()

        return files
    }

    fun readFile(uri: String): String {
        return try {
            val content = ApplicationManager.getApplication().runReadAction<String?> {
                val virtualFile = LocalFileSystem.getInstance().findFileByPath(UriUtils.parseUri(uri).path)
                if (virtualFile != null && FileDocumentManager.getInstance().isFileModified(virtualFile)) {
                    return@runReadAction FileDocumentManager.getInstance().getDocument(virtualFile)?.text
                }
                return@runReadAction null
            }

            if (content != null) {
                content
            } else {
                val file = UriUtils.uriToFile(uri)
                if (!file.exists() || file.isDirectory) return ""
                FileInputStream(file).use { fis ->
                    val sizeToRead = minOf(100000, file.length()).toInt()
                    val buffer = ByteArray(sizeToRead)
                    val bytesRead = fis.read(buffer, 0, sizeToRead)
                    if (bytesRead <= 0) return@use ""
                    val content = String(buffer, 0, bytesRead, Charset.forName("UTF-8"))
                    // Remove `\r` characters but preserve trailing newlines to prevent line count discrepancies
                    val contentWithoutCR = content.replace("\r\n", "\n").replace("\r", "\n")
                    contentWithoutCR
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }

    }


}