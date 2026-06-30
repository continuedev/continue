package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.utils.resolveWorkspacePaths
import com.intellij.openapi.application.Application
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.module.Module
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.roots.ModuleRootManager
import com.intellij.openapi.util.Computable
import com.intellij.openapi.util.ThrowableComputable
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileSystem
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import junit.framework.TestCase
import java.nio.file.Path

/**
 * Pure (no IntelliJ platform boot) test of the [resolveWorkspacePaths] glue.
 *
 * It mocks ModuleManager / ModuleRootManager / VirtualFile so the *whole* chain runs in a plain
 * JVM — `ModuleManager.modules` → each module's content roots → [VirtualFile.toUriOrNull] →
 * de-nesting — and asserts a multi-module window exposes every top-level root (including a sibling
 * pair sharing a textual prefix, the Problem B regression). This runs everywhere, including the
 * sandboxes where the heavy platform test framework cannot boot.
 */
class ResolveWorkspacePathsTest : TestCase() {

    private val project = mockk<Project>()

    override fun setUp() {
        // Make runReadAction { body } just execute body (no real Application needed).
        mockkStatic(ApplicationManager::class)
        val app = mockk<Application>()
        every { ApplicationManager.getApplication() } returns app
        // runReadAction's inline wrapper may forward to either the Computable or the
        // ThrowableComputable overload depending on the platform version — stub both.
        every { app.runReadAction(any<Computable<Array<String>>>()) } answers {
            firstArg<Computable<Array<String>>>().compute()
        }
        every { app.runReadAction(any<ThrowableComputable<Array<String>, Throwable>>()) } answers {
            firstArg<ThrowableComputable<Array<String>, Throwable>>().compute()
        }
        mockkStatic(ModuleManager::class)
        mockkStatic(ModuleRootManager::class)
    }

    override fun tearDown() = unmockkAll()

    /** A module whose content roots resolve (via toUriOrNull's NIO branch) to the given paths. */
    private fun moduleWithRoots(vararg nioPaths: String): Module {
        val module = mockk<Module>()
        val rootManager = mockk<ModuleRootManager>()
        val roots = nioPaths.map { p ->
            val fs = mockk<VirtualFileSystem>()
            val vf = mockk<VirtualFile>()
            every { vf.fileSystem } returns fs
            every { fs.getNioPath(vf) } returns Path.of(p)
            // `name` may be read by toUriOrNull in some code paths; stub defensively.
            every { vf.name } returns Path.of(p).fileName.toString()
            vf
        }.toTypedArray()
        every { ModuleRootManager.getInstance(module) } returns rootManager
        every { rootManager.contentRoots } returns roots
        return module
    }

    private fun setModules(vararg modules: Module) {
        val mm = mockk<ModuleManager>()
        every { ModuleManager.getInstance(project) } returns mm
        every { mm.modules } returns arrayOf(*modules)
    }

    /**
     * Mirrors how toUriOrNull's NIO branch derives a URI, so the assertions stay OS-independent:
     * Path.of("/ws/x").toUri() yields "file:///ws/x" on Unix but "file:///C:/ws/x" on Windows.
     */
    private fun expectedUri(nioPath: String): String =
        Path.of(nioPath).toUri().toString().removeSuffix("/")

    fun `test multi-module sibling roots with shared prefix all surface`() {
        setModules(
            moduleWithRoots("/ws/service"),
            moduleWithRoots("/ws/service-api"), // shares the "service" textual prefix
            moduleWithRoots("/ws/backend"),
        )

        val result = resolveWorkspacePaths(project).toList()

        assertEquals(
            listOf(expectedUri("/ws/service"), expectedUri("/ws/service-api"), expectedUri("/ws/backend")),
            result,
        )
    }

    fun `test nested content root is dropped while siblings are kept`() {
        setModules(
            moduleWithRoots("/ws/app", "/ws/app/submodule"), // one module, second root nested
            moduleWithRoots("/ws/app-extras"),               // prefix sibling of /ws/app
        )

        val result = resolveWorkspacePaths(project).toList()

        assertEquals(listOf(expectedUri("/ws/app"), expectedUri("/ws/app-extras")), result)
    }

    fun `test empty project yields no roots`() {
        setModules()

        assertEquals(emptyList<String>(), resolveWorkspacePaths(project).toList())
    }
}
