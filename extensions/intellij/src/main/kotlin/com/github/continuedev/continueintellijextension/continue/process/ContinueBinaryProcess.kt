package com.github.continuedev.continueintellijextension.`continue`.process

import com.github.continuedev.continueintellijextension.proxy.ProxySettings
import com.github.continuedev.continueintellijextension.error.ContinueErrorService
import com.github.continuedev.continueintellijextension.services.TelemetryService
import com.github.continuedev.continueintellijextension.utils.OS
import com.github.continuedev.continueintellijextension.utils.getContinueBinaryPath
import com.github.continuedev.continueintellijextension.utils.getOS
import com.intellij.openapi.components.service
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission

class ContinueBinaryProcess(
    private val onUnexpectedExit: () -> Unit
) : ContinueProcess {

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

        val builder = ProcessBuilder(path)
        val proxySettings = ProxySettings.getSettings()
        if (proxySettings.enabled)
            builder.environment() += "HTTP_PROXY" to proxySettings.proxy
        return builder
            .directory(File(path).parentFile)
            .start()
            .apply { onExit().thenRun(onUnexpectedExit).thenRun(::reportErrorTelemetry) }
    }

    private fun reportErrorTelemetry() {
        var err = process.errorStream?.bufferedReader()?.readText()?.trim()
        if (err != null) {
            // There are often "⚡️Done in Xms" messages, and we want everything after the last one
            val delimiter = "⚡ Done in"
            val doneIndex = err.lastIndexOf(delimiter)
            if (doneIndex != -1) {
                err = err.substring(doneIndex + delimiter.length)
            }
        }
        service<ContinueErrorService>().reportMessage("Core process exited with output: $err")
        service<TelemetryService>().capture("jetbrains_core_exit", mapOf("error" to err))
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
