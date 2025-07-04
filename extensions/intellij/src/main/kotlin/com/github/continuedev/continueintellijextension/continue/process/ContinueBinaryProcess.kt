package com.github.continuedev.continueintellijextension.`continue`.process

import com.github.continuedev.continueintellijextension.utils.OS
import com.github.continuedev.continueintellijextension.utils.getContinueBinaryPath
import com.github.continuedev.continueintellijextension.utils.getOS
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission

class ContinueBinaryProcess(private val onExit: () -> Unit) : ContinueProcess {

    private val process = startBinaryProcess()
    override val input: InputStream = process.inputStream
    override val output: OutputStream = process.outputStream

    override fun close() =
        process.destroy()

    private fun startBinaryProcess(): Process {
        val path = getContinueBinaryPath()
        runBlocking(Dispatchers.IO) {
            setPermissions()
        }
        return ProcessBuilder(path).directory(File(path).parentFile)
            .start()
            .apply { onExit().thenRun(onExit) }
    }

    private companion object {

        private fun setPermissions() {
            val os = getOS()
            when (os) {
                OS.MAC -> setMacOsPermissions()
                OS.WINDOWS -> {}
                OS.LINUX -> elevatePermissions()
            }
        }

        private fun setMacOsPermissions() {
            ProcessBuilder("xattr", "-dr", "com.apple.quarantine", getContinueBinaryPath()).start().waitFor()
            elevatePermissions()
        }

        private fun elevatePermissions() {
            val path = getContinueBinaryPath()
            val permissions = setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE
            )
            Files.setPosixFilePermissions(Paths.get(path), permissions)
        }
    }

}