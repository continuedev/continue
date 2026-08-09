package com.github.continuedev.continueintellijextension.`continue`

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.toUriOrNull
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.guessProjectDir
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader

class GitService(
    private val project: Project,
    private val continuePluginService: ContinuePluginService
) {


    /**
     * Returns the git diff for all workspace directories
     */
    suspend fun getDiff(includeUnstaged: Boolean): List<String> {
        val workspaceDirs = workspaceDirectories()
        val diffs = mutableListOf<String>()

        for (workspaceDir in workspaceDirs) {
            val output = StringBuilder()
            val builder = if (includeUnstaged) {
                ProcessBuilder("git", "diff")
            } else {
                ProcessBuilder("git", "diff", "--cached")
            }
            builder.directory(UriUtils.uriToFile(workspaceDir))
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