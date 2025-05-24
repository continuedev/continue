package com.github.continuedev.continueintellijextension.utils

import com.intellij.openapi.diff.impl.patch.*
import com.intellij.openapi.vcs.changes.patch.GitPatchWriter
import java.io.StringWriter
import java.nio.file.Path

/**
 * @author lk
 */
object DiffUtils {

    private const val DEV_NULL = "/dev/null"
    private const val A_PREFIX = "a/"
    private const val B_PREFIX = "b/"
    private const val NO_NEWLINE_SIGNATURE = "\\ No newline at end of file"
    private const val BINARY_FILES_DIFFER = "Binary files %s and %s differ"
    private const val HUNK_LINES_START = "@@ -%s,%s +%s,%s @@"

    /**
     * Generates a unified diff string for the given list of file patches.
     *
     * This method processes a list of file patches and generates a unified diff format string.
     * It handles both text and binary file patches, and includes special handling for patches
     * with no modified content.
     *
     * @param patches A list of [FilePatch] objects representing the changes to be included in the diff.
     * @param basePath The base path used to resolve the file paths in the patches.
     *
     * @return The unified diff representation of the provided patches.
     */
    fun diff(patches: List<FilePatch>, basePath: Path): String {
        val writer = StringWriter()
        val noContent = mutableListOf<FilePatch>()
        val binaryFilePatch = mutableListOf<FilePatch>()
        for (patch in patches) {
            if (patch is TextFilePatch) {
                if (patch.hasNoModifiedContent()) {
                    noContent.add(patch)
                    continue
                }
                GitPatchWriter.writeGitHeader(writer, basePath, patch, "\n")

                writer.write("--- " + getRevisionHeadingPath(patch, true) + "\n")
                writer.write("+++ " + getRevisionHeadingPath(patch, false) + "\n")

                for (hunk in patch.hunks) {
                    writeHunkStart(writer, hunk)
                    for (line in hunk.lines) {
                        val prefix = when (line.type) {
                            PatchLine.Type.CONTEXT -> " "
                            PatchLine.Type.ADD -> "+"
                            PatchLine.Type.REMOVE -> "-"
                        }
                        writer.write(prefix + line.text.trimEnd('\n') + "\n")
                        if (line.isSuppressNewLine) {
                            writer.write(NO_NEWLINE_SIGNATURE + "\n")
                        }
                    }
                }
            } else if (patch is BinaryFilePatch) {
                binaryFilePatch.add(patch)
            }
        }

        for (patch in noContent) {
            GitPatchWriter.writeGitHeader(writer, basePath, patch, "\n")
        }

        for (patch in binaryFilePatch) {
            GitPatchWriter.writeGitHeader(writer, basePath, patch, "\n")
            writer.write(
                String.format(
                    BINARY_FILES_DIFFER, getRevisionHeadingPath(patch, true), getRevisionHeadingPath(patch, false)
                )
            )
            writer.write("\n")
        }

        return writer.toString()
    }

    private fun writeHunkStart(writer: StringWriter, hunk: PatchHunk) {
        writer.append(
            String.format(
                HUNK_LINES_START,
                hunk.startLineBefore + 1,
                hunk.endLineBefore - hunk.startLineBefore,
                hunk.startLineAfter + 1,
                hunk.endLineAfter - hunk.startLineAfter
            )
        )
        writer.append("\n")
    }

    private fun getRevisionHeadingPath(patch: FilePatch, beforePath: Boolean): String {
        return if (beforePath) {
            if (patch.isNewFile) DEV_NULL else A_PREFIX + patch.beforeName
        } else {
            if (patch.isDeletedFile) DEV_NULL else B_PREFIX + patch.afterName
        }
    }
}