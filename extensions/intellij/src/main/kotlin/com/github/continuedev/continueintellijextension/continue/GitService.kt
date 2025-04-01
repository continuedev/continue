package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.guessProjectDir
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.URI

class GitService(
    private val project: Project,
    private val continuePluginService: ContinuePluginService
) {
    // Add a simple cache for diff results
    private data class DiffCache(
        val timestamp: Long,
        val diffs: List<String>
    )

    // Cache the last diff result
    private var diffCache: DiffCache? = null
    private var lastFileSaveTimestamp: Long = System.currentTimeMillis()

    /**
     * Updates the timestamp when a file is saved
     */
    fun updateLastFileSaveTimestamp() {
        lastFileSaveTimestamp = System.currentTimeMillis()
    }

    /**
     * Returns the git diff for all workspace directories
     */
    suspend fun getDiff(includeUnstaged: Boolean): List<String> {
        // Check if we have a valid cache entry
        if (diffCache != null && diffCache!!.timestamp == lastFileSaveTimestamp) {
            return diffCache!!.diffs
        }

        // If no cache hit, compute the diff
        val workspaceDirs = workspaceDirectories()
        val diffs = mutableListOf<String>()

        for (workspaceDir in workspaceDirs) {
            val output = StringBuilder()
            val builder = if (includeUnstaged) {
                ProcessBuilder("git", "diff")
            } else {
                ProcessBuilder("git", "diff", "--cached")
            }
            builder.directory(File(URI(workspaceDir)))
            val process = withContext(Dispatchers.IO) {
                builder.start()
            }

            val reader = BufferedReader(InputStreamReader(process.inputStream))
            var line: String? = withContext(Dispatchers.IO) {
                reader.readLine()
            }
            while (line != null) {
                output.append(line)
                output.append("\n")
                line = withContext(Dispatchers.IO) {
                    reader.readLine()
                }
            }

            withContext(Dispatchers.IO) {
                process.waitFor()
            }

            diffs.add(output.toString())
        }

        // Cache the result
        diffCache = DiffCache(lastFileSaveTimestamp, diffs)
        return diffs
    }

    private fun workspaceDirectories(): Array<String> {
        val dirs = this.continuePluginService.workspacePaths

        if (dirs?.isNotEmpty() == true) {
            return dirs
        }

        return listOfNotNull(project.guessProjectDir()?.toUriOrNull()).toTypedArray()
    }

}