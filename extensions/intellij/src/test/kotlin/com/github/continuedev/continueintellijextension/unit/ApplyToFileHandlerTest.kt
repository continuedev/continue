package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.ApplyStateStatus
import com.github.continuedev.continueintellijextension.IDE
import com.github.continuedev.continueintellijextension.ApplyState
import com.github.continuedev.continueintellijextension.`continue`.ApplyToFileHandler
import com.github.continuedev.continueintellijextension.`continue`.CoreMessenger
import com.github.continuedev.continueintellijextension.editor.DiffStreamService
import com.github.continuedev.continueintellijextension.editor.EditorUtils
import com.github.continuedev.continueintellijextension.protocol.ApplyToFileParams
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import io.mockk.*
import junit.framework.TestCase
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest

@ExperimentalCoroutinesApi
class ApplyToFileHandlerTest : TestCase() {
    // Mock all dependencies
    private val mockProject = mockk<Project>(relaxed = true)
    private val mockContinuePluginService = mockk<ContinuePluginService>(relaxed = true)
    private val mockIde = mockk<IDE>(relaxed = true)
    private val mockEditorUtils = mockk<EditorUtils>(relaxed = true)
    private val mockDiffStreamService = mockk<DiffStreamService>(relaxed = true)
    private val mockEditor = mockk<Editor>(relaxed = true)
    private val mockCoreMessenger = mockk<CoreMessenger>(relaxed = true)

    // Test subject
    private lateinit var handler: ApplyToFileHandler

    // Constants for testing
    private val testParams = ApplyToFileParams(
        "Sample text to apply",
        "stream123",
        "test/file.kt",
        "tool-call-123"
    )

    override fun setUp() {
        // Common setup
        every { mockEditorUtils.editor } returns mockEditor
        every { mockContinuePluginService.coreMessenger } returns mockCoreMessenger

        // Create the handler with mocked dependencies
        handler = ApplyToFileHandler(
            mockProject,
            mockContinuePluginService,
            mockIde,
            testParams,
            mockEditorUtils,
            mockDiffStreamService
        )
    }

    fun `test should insert text directly when document is empty`() = runTest {
        // Given
        every { mockEditorUtils.isDocumentEmpty() } returns true

        // When
        handler.handleApplyToFile()

        // Then
        verify { mockEditorUtils.insertTextIntoEmptyDocument(testParams.text) }
        verify(exactly = 0) { mockDiffStreamService.register(any(), any()) } // Ensure no diff streaming happened

        // Verify notifications sent
        verify {
            mockContinuePluginService.sendToWebview(
                eq("updateApplyState"),
                withArg { payload ->
                    assert(payload is ApplyState)
                    assert((payload as ApplyState).status == ApplyStateStatus.STREAMING.status)
                },
                any()
            )
        }

        verify {
            mockContinuePluginService.sendToWebview(
                eq("updateApplyState"),
                withArg { payload ->
                    assert(payload is ApplyState)
                    assert((payload as ApplyState).status == ApplyStateStatus.CLOSED.status)
                },
                any()
            )
        }
    }
}
