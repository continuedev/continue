package com.github.continuedev.continueintellijextension.`continue`.process

import com.github.continuedev.continueintellijextension.proxy.ProxySettings
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

class ContinueBinaryProcess() : ContinueProcess {

    private val process = start()
    override val input: InputStream = process.inputStream
    override val output: OutputStream = process.outputStream

    override fun close() =
        process.destroy()

    private companion object {

        private fun start(): Process {
            val path = getContinueBinaryPath()
            setPermissions()
            val builder = ProcessBuilder(path)
            builder.environment() += ProxySettings.getSettings().toContinueEnvVars()
            return builder
                .directory(File(path).parentFile)
                .start()
        }

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

        // todo: consider setting permissions ahead-of-time during build/packaging, not at runtime
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
