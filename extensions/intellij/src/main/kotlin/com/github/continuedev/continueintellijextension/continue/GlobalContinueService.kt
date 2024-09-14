package com.github.continuedev.continueintellijextension.`continue`

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission

@Service
class GlobalContinueService {

    private var continueProcess: ContinueProcess? = null

    // 初始化进程
    fun initProcess(esbuildPath: String, continueCorePath: String) {
        if (continueProcess == null) {
            continueProcess = ContinueProcess(esbuildPath, continueCorePath)
            this.continueProcess = continueProcess
        }
    }

    // 获取进程
    fun getGlobalContinueProcess(): ContinueProcess? {
        return continueProcess
    }

    // 以下为ContinueProcess类的简化版本
    class ContinueProcess(esbuildPath: String, continueCorePath: String) {
        private var continueProcess: Process? = null
        private val esbuildPath: String
        private val continueCorePath: String

        init {
            this.esbuildPath = esbuildPath
            this.continueCorePath = continueCorePath
            if (this.continueProcess == null) {
                this.continueProcess = ProcessBuilder(continueCorePath).directory(File(continueCorePath).parentFile).start()
            }
        }

        fun getContinueProcess(): Process? {
            return continueProcess
        }

        private fun setPermissions(destination: String) {
            val osName = System.getProperty("os.name").toLowerCase()
            if (osName.contains("mac") || osName.contains("darwin")) {
                ProcessBuilder("xattr", "-dr", "com.apple.quarantine", destination).start()
                setFilePermissions(destination, "rwxr-xr-x")
            } else if (osName.contains("nix") || osName.contains("nux") || osName.contains("mac")) {
                setFilePermissions(destination, "rwxr-xr-x")
            }
        }

        private fun setFilePermissions(path: String, posixPermissions: String) {
            val perms = HashSet<PosixFilePermission>()
            if (posixPermissions.contains("r")) perms.add(PosixFilePermission.OWNER_READ)
            if (posixPermissions.contains("w")) perms.add(PosixFilePermission.OWNER_WRITE)
            if (posixPermissions.contains("x")) perms.add(PosixFilePermission.OWNER_EXECUTE)
            Files.setPosixFilePermissions(Paths.get(path), perms)
        }
    }
}
